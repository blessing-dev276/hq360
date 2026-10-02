import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// expert_profiles/expert_portfolio_items, and team_members.claimed_by_expert_id,
// aren't in the generated Database type yet (pending migration push).
export const expertProfiles = () => (supabaseAdmin as SupabaseClient).from("expert_profiles");
export const expertPortfolioItems = () =>
  (supabaseAdmin as SupabaseClient).from("expert_portfolio_items");
export const teamMembersUntyped = () => (supabaseAdmin as SupabaseClient).from("team_members");
export const expertInvoiceRequests = () =>
  (supabaseAdmin as SupabaseClient).from("expert_invoice_requests");

const COOKIE_NAME = "hq360_expert";
const SESSION_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}
function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
function signature(userId: string, expiresAt: string): string {
  return createHmac("sha256", secret()).update(`${userId}.${expiresAt}`).digest("base64url");
}
export type ExpertProfile = {
  id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "approved" | "rejected";
};
/** Verifies a Supabase access token belongs to an approved expert. Re-checks
 *  status against the DB rather than trusting anything embedded in the token,
 *  so a revoked expert loses access immediately, not just at next login. */
export async function approvedProfileForToken(accessToken: string): Promise<ExpertProfile | null> {
  const { data: userData, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !userData.user) return null;
  const { data: profile } = await expertProfiles()
    .select("id, email, full_name, status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile || profile.status !== "approved") return null;
  return profile as ExpertProfile;
}
export async function expertSessionCookie(userId: string): Promise<string> {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = `${userId}.${expiresAt}.${signature(userId, expiresAt)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE_SECONDS}${secure}`;
}
export function clearExpertCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
/** Returns the expert's id if the request carries a valid, still-approved
 *  expert session cookie; null otherwise. Re-checks approval status live. */
export async function isExpertRequest(request: Request): Promise<string | null> {
  if (!secret()) return null;
  const cookies = request.headers.get("cookie") ?? "";
  const raw = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  const [userId, expiresAt, suppliedSignature] = raw.split(".");
  if (!userId || !expiresAt || !suppliedSignature || !/^\d+$/.test(expiresAt)) return null;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  if (!safeEqual(suppliedSignature, signature(userId, expiresAt))) return null;
  const { data: profile } = await expertProfiles().select("status").eq("id", userId).maybeSingle();
  return (profile as { status?: string } | null)?.status === "approved" ? userId : null;
}
export type StaffAccess = { role: "admin" } | { role: "expert"; expertId: string };
/** Combined gate for routes shared between full admins and approved experts
 *  (Audit + Scout). Everywhere else keeps using isAdminRequest alone. */
export async function resolveStaffAccess(request: Request): Promise<StaffAccess | null> {
  if (await isAdminRequest(request)) return { role: "admin" };
  const expertId = await isExpertRequest(request);
  return expertId ? { role: "expert", expertId } : null;
}
/** Back-compat shape for route files that only need a boolean gate. */
export async function isAdminOrExpertRequest(request: Request): Promise<boolean> {
  return (await resolveStaffAccess(request)) !== null;
}
