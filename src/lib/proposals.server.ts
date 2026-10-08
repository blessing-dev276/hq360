import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const proposalsTable = () => (supabaseAdmin as SupabaseClient).from("proposals");

export const PROPOSAL_FIELDS =
  "id, token, owner, title, client_name, client_email, subtitle, details, body, prepared_by, prepared_by_role, footer_note, sent_at, sent_to, views, last_viewed_at, created_at, updated_at";
/** What the client may see. */
export const PUBLIC_PROPOSAL_FIELDS =
  "token, title, client_name, subtitle, details, body, prepared_by, prepared_by_role, footer_note, created_at, updated_at";

const text = (max: number) => z.string().trim().max(max);
export const proposalInput = z.object({
  title: text(200).min(1, "Give the proposal a title"),
  client_name: text(160),
  client_email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid client email")
    .max(254)
    .or(z.literal("")),
  subtitle: text(300),
  details: z
    .array(z.object({ label: text(60), value: text(300) }))
    .max(12)
    .transform((rows) => rows.filter((r) => r.label && r.value)),
  body: text(100000),
  prepared_by: text(160),
  prepared_by_role: text(160),
  footer_note: text(600),
});
export type ProposalInput = z.infer<typeof proposalInput>;

export function proposalLink(token: string) {
  const site = new URL(process.env.SITE_URL || "https://www.hq360.space");
  return `${site.origin}/proposal/${token}`;
}

/** Email the proposal link to the client. Throws with a readable message. */
export async function emailProposal(p: {
  token: string;
  title: string;
  client_name: string;
  client_email: string;
  prepared_by: string;
  prepared_by_role: string;
}) {
  if (!p.client_email) throw new Error("Add the client's email address first.");
  const link = proposalLink(p.token);
  const { buildProposalEmail } = await import("./proposal-email");
  const email = buildProposalEmail(p, link, new URL(link).origin);
  const { sendEmail, leadInboxAddress } = await import("@/lib/email.server");
  const result = await sendEmail({
    to: p.client_email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    // Replies go to a real, monitored inbox.
    replyTo: leadInboxAddress(),
  });
  if (!result.sent)
    throw new Error(
      "The proposal was not emailed. Check the email provider settings, or copy the link instead.",
    );
  return link;
}
