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
