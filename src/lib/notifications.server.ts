import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Notifications are written by database triggers (migration 20261002160000);
// these helpers only list them and mark them read for one recipient.
export type Recipient = { audience: "admin" } | { audience: "expert"; expertId: string };

const table = () => (supabaseAdmin as SupabaseClient).from("notifications");
const FIELDS = "id, created_at, kind, title, body, tab, read_at";

function scope(who: Recipient): Record<string, string> {
  return who.audience === "admin"
    ? { audience: "admin" }
    : { audience: "expert", expert_id: who.expertId };
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function listNotifications(who: Recipient) {
  const [list, unread] = await Promise.all([
    table().select(FIELDS).match(scope(who)).order("created_at", { ascending: false }).limit(30),
    table().select("id", { count: "exact", head: true }).match(scope(who)).is("read_at", null),
  ]);
  if (list.error || unread.error) return json({ error: "Could not load notifications." }, 503);
  return json({ items: list.data ?? [], unread: unread.count ?? 0 });
}

const markSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
]);

export async function markNotifications(request: Request, who: Recipient) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  const parsed = markSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  let query = table()
    .update({ read_at: new Date().toISOString() })
    .match(scope(who))
    .is("read_at", null);
  if ("ids" in parsed.data) query = query.in("id", parsed.data.ids);
  const { error } = await query;
  if (error) return json({ error: "Could not update notifications." }, 503);
  return json({ ok: true });
}

const TAB_LABELS: Record<string, string> = {
  experts: "Experts",
  payments: "Invoices",
  projects: "Leads & Follow-ups",
  audits: "Audit",
};

/** Email every admin notification not yet emailed, as one message (a digest
 *  when several are waiting), to the HQ360 inbox and the founder. Safe to
 *  call any number of times: rows are claimed before sending. */
export async function emailPendingAdminNotifications() {
  const now = new Date();
  const stale = new Date(now.getTime() - 5 * 60_000).toISOString();
  const recent = new Date(now.getTime() - 2 * 86400_000).toISOString();
  const { data: claimed, error } = await table()
    .update({ email_claimed_at: now.toISOString() })
    .eq("audience", "admin")
    .is("emailed_at", null)
    .gte("created_at", recent)
    .or(`email_claimed_at.is.null,email_claimed_at.lt.${stale}`)
    .select("id, created_at, title, body, tab");
  if (error || !claimed?.length) return { sent: 0 };
  const items = (
    claimed as { id: string; created_at: string; title: string; body: string; tab: string | null }[]
  ).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const { sendEmail, leadInboxAddress } = await import("@/lib/email.server");
  const { data: founder } = await (supabaseAdmin as SupabaseClient)
    .from("expert_profiles")
    .select("email")
    .eq("is_founder", true)
    .maybeSingle();
  const recipients = [
    ...new Set(
      [
        leadInboxAddress(),
        ...(process.env.ADMIN_NOTIFY_EMAIL ?? "").split(","),
        (founder as { email?: string } | null)?.email ?? "",
      ]
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space").origin;
  const link = (tab: string | null) => `${site}/admin${tab ? `#${tab}` : ""}`;
  const subject =
    items.length === 1 ? `HQ360: ${items[0]!.title}` : `HQ360: ${items.length} new updates`;
  const text = [
    items.length === 1
      ? "There's a new update in your HQ360 admin."
      : `There are ${items.length} new updates in your HQ360 admin.`,
    "",
    ...items.map(
      (n) =>
        `• ${n.title}\n  ${n.body}\n  Open ${TAB_LABELS[n.tab ?? ""] ?? "admin"}: ${link(n.tab)}`,
    ),
    "",
    "You're receiving this because you're an HQ360 admin.",
  ].join("\n");

  const results = await Promise.all(recipients.map((to) => sendEmail({ to, subject, text })));
  const ids = items.map((n) => n.id);
  if (results.some((r) => r.sent)) {
    await table().update({ emailed_at: new Date().toISOString() }).in("id", ids);
    return { sent: items.length };
  }
  // Nothing went out: release the claim so the next ping retries.
  await table().update({ email_claimed_at: null }).in("id", ids);
  return { sent: 0, error: results[0]?.error };
}

/** Notify one expert from server code (for admin actions a trigger can't
 *  attribute, e.g. admin editing their profile). Best-effort: never throws. */
export async function notifyExpert(
  expertId: string,
  kind: string,
  title: string,
  body: string,
  tab: string,
) {
  const { error } = await table().insert({
    audience: "expert",
    expert_id: expertId,
    kind,
    title,
    body,
    tab,
  });
  if (error) console.error("[notifications] notifyExpert", error.message);
}

/** Email each expert their notifications not yet emailed (a digest when
 *  several are waiting), linking into their workspace. Safe to call any
 *  number of times: rows are claimed before sending. */
// Expert emails started here; older notifications are never emailed.
const EXPERT_EMAILS_FROM = "2026-10-02T14:00:00Z";

export async function emailPendingExpertNotifications() {
  const now = new Date();
  const stale = new Date(now.getTime() - 5 * 60_000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400_000).toISOString();
  const recent = twoDaysAgo > EXPERT_EMAILS_FROM ? twoDaysAgo : EXPERT_EMAILS_FROM;
  const { data: claimed, error } = await table()
    .update({ email_claimed_at: now.toISOString() })
    .eq("audience", "expert")
    .is("emailed_at", null)
    .gte("created_at", recent)
    .or(`email_claimed_at.is.null,email_claimed_at.lt.${stale}`)
    .select("id, created_at, expert_id, title, body, tab");
  if (error || !claimed?.length) return { sent: 0 };
  type Row = {
    id: string;
    created_at: string;
    expert_id: string;
    title: string;
    body: string;
    tab: string | null;
  };
  const byExpert = new Map<string, Row[]>();
  for (const row of claimed as Row[])
    byExpert.set(row.expert_id, [...(byExpert.get(row.expert_id) ?? []), row]);

  const { data: profiles } = await (supabaseAdmin as SupabaseClient)
    .from("expert_profiles")
    .select("id, email, full_name")
    .in("id", [...byExpert.keys()]);
  const { sendEmail } = await import("@/lib/email.server");
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space").origin;
  let sent = 0;
  for (const [expertId, rows] of byExpert) {
    const items = rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const ids = items.map((n) => n.id);
    const profile = (profiles ?? []).find((p) => p.id === expertId) as
      { email: string; full_name: string | null } | undefined;
    if (!profile?.email) {
      // No address to send to; mark handled so it isn't retried forever.
      await table().update({ emailed_at: new Date().toISOString() }).in("id", ids);
      continue;
    }
    const first = profile.full_name?.split(/\s+/)[0];
    const text = [
      `Hi ${first || "there"},`,
      "",
      items.length === 1
        ? "There's a new update in your HQ360 expert workspace."
        : `There are ${items.length} new updates in your HQ360 expert workspace.`,
      "",
      ...items.map(
        (n) => `• ${n.title}\n  ${n.body}\n  Open: ${site}/expert${n.tab ? `#${n.tab}` : ""}`,
      ),
      "",
      "— HQ360",
    ].join("\n");
    const result = await sendEmail({
      to: profile.email,
      subject: items.length === 1 ? `HQ360: ${items[0]!.title}` : `HQ360: ${items.length} updates`,
      text,
    });
    if (result.sent) {
      await table().update({ emailed_at: new Date().toISOString() }).in("id", ids);
      sent += items.length;
    } else {
      // Release the claim so the next ping retries.
      await table().update({ email_claimed_at: null }).in("id", ids);
    }
  }
  return { sent };
}
