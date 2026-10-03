import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Outreach is sent from a dedicated sender so cold-email reputation never
// touches invoices and client mail. Configure in the host environment:
//   OUTREACH_EMAIL_FROM="Blessing at HQ360 <hello@mail.hq360.space>"  (required)
//   OUTREACH_REPLY_TO=ceo@hq360.space          (defaults to the lead inbox)
//   OUTREACH_SENDER_NAME, OUTREACH_SENDER_TITLE  (signature)
//   OUTREACH_ADDRESS                            (postal address in the footer)
//   OUTREACH_DAILY_LIMIT                        (default 40)

export const outreachMessages = () => (supabaseAdmin as SupabaseClient).from("outreach_messages");
export const outreachSuppressions = () =>
  (supabaseAdmin as SupabaseClient).from("outreach_suppressions");

export function outreachConfig() {
  const from = process.env.OUTREACH_EMAIL_FROM?.trim() || "";
  const fromName = from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return {
    configured: Boolean(from),
    from,
    replyTo: process.env.OUTREACH_REPLY_TO?.trim() || "",
    senderName: process.env.OUTREACH_SENDER_NAME?.trim() || fromName || "The HQ360 team",
    senderTitle: process.env.OUTREACH_SENDER_TITLE?.trim() || "",
    address: process.env.OUTREACH_ADDRESS?.trim() || "",
    dailyLimit: Math.max(1, Number(process.env.OUTREACH_DAILY_LIMIT) || 40),
    siteOrigin: new URL(process.env.SITE_URL || "https://www.hq360.space").origin,
  };
}

function secret() {
  return process.env.OUTREACH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function unsubscribeToken(email: string) {
  return createHmac("sha256", secret())
    .update(`unsubscribe:${email.toLowerCase()}`)
    .digest("base64url");
}

export function validUnsubscribe(email: string, token: string) {
  if (!secret() || !email || !token) return false;
  const expected = Buffer.from(unsubscribeToken(email));
  const supplied = Buffer.from(token);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function unsubscribeUrls(email: string, siteOrigin: string) {
  const query = `e=${encodeURIComponent(email.toLowerCase())}&t=${unsubscribeToken(email)}`;
  return {
    // Human page (link in the email): asks to confirm, so link scanners can't unsubscribe people.
    page: `${siteOrigin}/unsubscribe?${query}`,
    // RFC 8058 one-click endpoint used by Gmail/Yahoo's built-in Unsubscribe button.
    oneClick: `${siteOrigin}/api/outreach/unsubscribe?${query}`,
  };
}
