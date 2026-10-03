import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { leadSchema } from "@/lib/sales";

/** Who is asking: the admin team (sees every owner) or one expert (sees and
 *  edits only leads they own). */
export type LeadScope = { kind: "admin" } | { kind: "expert"; expertId: string };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as SupabaseClient;
}
const ownerOf = (scope: LeadScope) => (scope.kind === "admin" ? "hq360" : scope.expertId);
const ids = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter(Boolean))] as string[];

/** Leads with the context needed to manage them: where each came from
 *  (website inquiry, visibility check, Scouting batch + book), plus events
 *  and linkable invoices. */
async function listLeads(scope: LeadScope) {
  const d = await db();
  let query = d.from("sales_leads").select("*").order("created_at", { ascending: false });
  if (scope.kind === "expert") query = query.eq("owner", scope.expertId);
  const { data: leads, error } = await query;
  if (error)
    return json({ ok: false, error: "Could not load leads. Check the sales migration." }, 503);
  const rows = (leads ?? []) as Record<string, unknown>[];
  const leadIds = rows.map((l) => l.id as string);
  const bySource = (kind: string) =>
    ids(rows.filter((l) => l.source_kind === kind).map((l) => l.source_id as string));

  const scoutIds = bySource("scout");
  const visibilityIds = bySource("visibility_check");
  const inquiryIds = bySource("inquiry");
  const [prospects, audits, inquiries, events, invoices] = await Promise.all([
    scoutIds.length
      ? d.from("scout_prospects").select("id, book_id, scout_author_id").in("id", scoutIds)
      : { data: [] },
    visibilityIds.length
      ? d.from("author_audit_leads").select("id, book_title").in("id", visibilityIds)
      : { data: [] },
    inquiryIds.length
      ? d
          .from("project_inquiries")
          .select("id, industry, help_with, source_industry, source_path")
          .in("id", inquiryIds)
      : { data: [] },
    leadIds.length
      ? d
          .from("sales_events")
          .select("lead_id, event, detail, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })
      : { data: [] },
    scope.kind === "admin"
      ? d
          .from("payment_invoices")
          .select("id, number, buyer_name, status, environment, payment_token")
          .order("created_at", { ascending: false })
          .limit(300)
      : ids(rows.map((l) => l.invoice_id as string)).length
        ? d
            .from("payment_invoices")
            .select("id, number, buyer_name, status, environment, payment_token")
            .in("id", ids(rows.map((l) => l.invoice_id as string)))
        : { data: [] },
  ]);

  const prospectRows = (prospects.data ?? []) as {
    id: string;
    book_id: string | null;
    scout_author_id: string;
  }[];
  const { authorPresence, presenceFor } = await import("@/lib/scout/owner.server");
  const { asScoutDb } = await import("@/lib/scout/db");
  const presence = await authorPresence(
    asScoutDb(d),
    prospectRows.map((p) => p.scout_author_id),
  );
  const { data: books } = ids(prospectRows.map((p) => p.book_id)).length
    ? await d
        .from("scout_discovered_books")
        .select("id, title, batch_id")
        .in("id", ids(prospectRows.map((p) => p.book_id)))
    : { data: [] };
  const bookRows = (books ?? []) as { id: string; title: string; batch_id: string | null }[];
  const { data: batches } = ids(bookRows.map((b) => b.batch_id)).length
    ? await d
        .from("scout_batches")
        .select("id, label")
        .in("id", ids(bookRows.map((b) => b.batch_id)))
    : { data: [] };
  const batchRows = (batches ?? []) as { id: string; label: string }[];

  const owners = ids(rows.map((l) => l.owner as string).filter((o) => o !== "hq360"));
  const { data: experts } =
    scope.kind === "admin" && owners.length
      ? await d.from("expert_profiles").select("id, full_name, email").in("id", owners)
      : { data: [] };
  const expertRows = (experts ?? []) as { id: string; full_name: string | null; email: string }[];

  const items = rows.map((lead) => {
    let context: Record<string, unknown> | null = null;
    if (lead.source_kind === "scout") {
      const prospect = prospectRows.find((p) => p.id === lead.source_id);
      const book = bookRows.find((b) => b.id === prospect?.book_id);
      const batch = batchRows.find((b) => b.id === book?.batch_id);
      context = {
        book_title: book?.title ?? null,
        batch_label: batch?.label ?? null,
        // Other workspaces that also scouted / generated this author.
        presence: presenceFor(presence, prospect?.scout_author_id, String(lead.owner ?? "hq360")),
      };
    } else if (lead.source_kind === "visibility_check") {
      const audit = ((audits.data ?? []) as { id: string; book_title: string }[]).find(
        (a) => a.id === lead.source_id,
      );
      context = { book_title: audit?.book_title ?? null };
    }
    const inquiry =
      lead.source_kind === "inquiry"
        ? (((inquiries.data ?? []) as { id: string }[]).find((i) => i.id === lead.source_id) ??
          null)
        : null;
    const owner = expertRows.find((e) => e.id === lead.owner);
    return {
      ...lead,
      owner: lead.owner ?? "hq360",
      context,
      inquiry_context: inquiry,
      owner_name:
        (lead.owner ?? "hq360") === "hq360"
          ? "HQ360"
          : owner?.full_name || owner?.email || "Expert",
    };
  });
  return json({ ok: true, items, invoices: invoices.data ?? [], events: events.data ?? [] });
}

/** Create a manual lead (owned by the caller) or update one the caller owns. */
async function saveLead(request: Request, scope: LeadScope) {
  const d = await db();
  const raw = await request.json().catch(() => null);
  const parsed = (
    request.method === "PATCH" ? leadSchema.partial().extend({ id: z.string().uuid() }) : leadSchema
  ).safeParse(raw);
  if (!parsed.success)
    return json({ ok: false, error: "Check the required fields, dates and links." }, 400);
  const { id, ...values } = parsed.data as Partial<z.infer<typeof leadSchema>> & { id?: string };

  if (id) {
    const { data: existing } = await d
      .from("sales_leads")
      .select("source_kind, source_id, owner")
      .eq("id", id)
      .maybeSingle();
    if (!existing || (scope.kind === "expert" && existing.owner !== scope.expertId))
      return json({ ok: false, error: "Lead not found" }, 404);
    if (existing.source_kind === "scout" && values.stage && values.stage !== "lost") {
      const { data: prospect } = await d
        .from("scout_prospects")
        .select("status, do_not_contact")
        .eq("id", existing.source_id)
        .maybeSingle();
      if (!prospect || prospect.do_not_contact || prospect.status === "excluded")
        return json(
          {
            ok: false,
            error: "This Scout prospect is excluded or unavailable. Review it in Scouting first.",
          },
          409,
        );
    }
    // Experts can only link invoices that were created from their own requests.
    if (scope.kind === "expert" && values.invoice_id) {
      const { data: own } = await d
        .from("payment_invoices")
        .select("id")
        .eq("id", values.invoice_id)
        .eq("requested_by_expert_id", scope.expertId)
        .maybeSingle();
      if (!own) return json({ ok: false, error: "That invoice isn't one of yours." }, 403);
    }
  }
  const query = id
    ? d
        .from("sales_leads")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id)
    : d.from("sales_leads").insert({ ...values, source_kind: "manual", owner: ownerOf(scope) });
  const { data, error } = await query.select("*").single();
  if (error || !data) return json({ ok: false, error: "Could not save lead." }, 500);

  if (scope.kind === "admin") {
    const { forwardLead } = await import("@/lib/lead-forwarding.server");
    const result = await forwardLead({
      kind: "sales_lead_updated",
      recordKey: `${data.source_kind}:${data.source_id ?? data.id}`,
      id: data.id,
      createdAt: data.created_at,
      name: data.name,
      email: data.email,
      fields: data,
    });
    return json({ ok: true, item: data, forwarded: result.forwarded });
  }
  return json({ ok: true, item: data });
}

export async function handleLeads(request: Request, scope: LeadScope) {
  try {
    if (request.method === "GET") return await listLeads(scope);
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return json({ ok: false, error: "Invalid origin" }, 403);
    return await saveLead(request, scope);
  } catch {
    return json({ ok: false, error: "Leads are unavailable right now." }, 503);
  }
}
