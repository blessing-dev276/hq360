import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveStaffAccess } from "@/lib/expert-auth.server";

export const quotesTable = () => (supabaseAdmin as SupabaseClient).from("price_quotes");

export const QUOTE_FIELDS =
  "id, token, owner, prepared_by, client_name, project_title, intro, currency, packages, notes, valid_until, views, last_viewed_at, created_at, updated_at";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Admin (sees every quote) or an expert granted the "quotes" tool (own only). */
export async function quoteAccess(request: Request) {
  const access = await resolveStaffAccess(request);
  if (!access) return null;
  if (access.role === "admin") return { owner: "hq360", admin: true, name: "HQ360" };
  const { data } = await (supabaseAdmin as SupabaseClient)
    .from("expert_profiles")
    .select("full_name, email")
    .eq("id", access.expertId)
    .maybeSingle();
  const profile = data as { full_name: string | null; email: string } | null;
  return {
    owner: access.expertId,
    admin: false,
    name: profile?.full_name || profile?.email || "HQ360 Expert",
  };
}
