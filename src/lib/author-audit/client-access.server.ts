import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { accessActive, digest } from "./client-security";
import type { ReportData } from "./report-data";

// These tables are added by the private-audit migration, before type regeneration.
export const clientDb = () => supabaseAdmin as unknown as SupabaseClient;
export type ClientAccess = {
  audit_id: string;
  public_slug: string;
  version_id: string;
  generation: string;
  access_enabled: boolean;
  revoked_at: string | null;
  expires_at: string | null;
};
export function privateJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      ...extra,
    },
  });
}
export async function clientSession(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("hq360_audit="))
    ?.slice(12);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = clientDb();
  const { data: session, error } = await db
    .from("audit_client_sessions")
    .select("*")
    .eq("token_hash", digest(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !session) return null;
  const { data: access } = await db
    .from("audit_client_access")
    .select("*")
    .eq("audit_id", session.audit_id)
    .maybeSingle();
  if (!access || !accessActive(access) || access.generation !== session.generation) return null;
  return access as ClientAccess;
}
export async function issueSession(access: ClientAccess) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Math.min(
      Date.now() + 12 * 3600_000,
      access.expires_at ? Date.parse(access.expires_at) : Infinity,
    ),
  );
  const { error } = await clientDb()
    .from("audit_client_sessions")
    .insert({
      token_hash: digest(token),
      audit_id: access.audit_id,
      generation: access.generation,
      expires_at: expiresAt.toISOString(),
    });
  if (error) throw error;
  return `hq360_audit=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export async function snapshotFor(access: ClientAccess): Promise<ReportData> {
  const { data, error } = await clientDb()
    .from("audit_client_versions")
    .select("snapshot")
    .eq("id", access.version_id)
    .eq("audit_id", access.audit_id)
    .not("published_at", "is", null)
    .single();
  if (error || !data) throw new Error("Report unavailable");
  return data.snapshot as ReportData;
}
export async function throttle(key: string, limit = 10, seconds = 900) {
  const { data, error } = await clientDb().rpc("audit_access_rate_limit", {
    bucket_key: key,
    attempt_limit: limit,
    window_seconds: seconds,
  });
  return !error && data === true;
}
