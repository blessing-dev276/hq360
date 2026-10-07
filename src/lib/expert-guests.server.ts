import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { expertProfiles } from "@/lib/expert-auth.server";
import { EXPERT_FEATURES } from "@/lib/expert-roles";

const INVITE_DAYS = 7;
const FEATURE_KEYS = EXPERT_FEATURES.map((f) => f.key) as [string, ...string[]];

export const guestInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  full_name: z.string().trim().min(2).max(150),
  permissions: z.array(z.enum(FEATURE_KEYS)).min(1, "Pick at least one tool."),
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function siteOrigin() {
  return new URL(process.env.SITE_URL || "https://www.hq360.space").origin;
}

/** Issue a fresh one-time "set your password" link and email it. Returns the
 *  link too, so the admin can share it by hand if email isn't delivered. */
async function issueInvite(expertId: string, email: string, fullName: string, tools: string[]) {
  const token = randomBytes(32).toString("hex");
  const { error } = await expertProfiles()
    .update({
      invite_token_hash: hashToken(token),
      invite_expires_at: new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString(),
      invited_at: new Date().toISOString(),
    })
    .eq("id", expertId);
  if (error) throw new Error("Could not create the invite link.");
  const link = `${siteOrigin()}/expert-welcome?token=${token}`;
  const labels = EXPERT_FEATURES.filter((f) => tools.includes(f.key)).map((f) => f.label);
  const { sendEmail, leadInboxAddress } = await import("@/lib/email.server");
  const first = fullName.split(/\s+/)[0];
  const result = await sendEmail({
    to: email,
    subject: "You're invited to the HQ360 workspace",
    replyTo: leadInboxAddress(),
    text: [
      `Hi ${first || "there"},`,
      "",
      `HQ360 has invited you to use ${labels.join(", ")} in the HQ360 workspace.`,
      "",
      "Set your password to get started:",
      link,
      "",
      `This link works once and expires in ${INVITE_DAYS} days. After that, sign in at ${siteOrigin()}/expert with this email and your password.`,
      "",
      "— HQ360",
    ].join("\n"),
  });
  return { link, emailed: result.sent };
}

export async function inviteGuest(input: z.infer<typeof guestInviteSchema>) {
  const { data: existing } = await expertProfiles()
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();
  if (existing) throw new Error("This email already has an expert or guest account.");

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    // Never shared: the guest sets their own password from the invite link.
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { account_type: "expert", full_name: input.full_name, guest: true },
  });
  if (error || !data.user)
    throw new Error(
      error?.status === 422 || /already/i.test(error?.message ?? "")
        ? "This email already has an HQ360 login."
        : "Could not create the guest account.",
    );
  const id = data.user.id;
  const fields = {
    full_name: input.full_name,
    status: "approved",
    reviewed_at: new Date().toISOString(),
    is_guest: true,
    role: "custom",
    permissions: input.permissions,
  };
  // The auth trigger normally creates the row; insert it if it didn't.
  const { data: updated } = await expertProfiles().update(fields).eq("id", id).select("id");
  if (!updated?.length) {
    const { error: insertError } = await expertProfiles().insert({
      id,
      email: input.email,
      ...fields,
    });
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("Could not create the guest account.");
    }
  }
  return { id, ...(await issueInvite(id, input.email, input.full_name, input.permissions)) };
}

export async function resendGuestInvite(expertId: string) {
  const { data } = await expertProfiles()
    .select("email, full_name, permissions, is_guest")
    .eq("id", expertId)
    .maybeSingle();
  const row = data as {
    email: string;
    full_name: string | null;
    permissions: string[];
    is_guest: boolean;
  } | null;
  if (!row?.is_guest) throw new Error("Only guests can be re-invited.");
  return issueInvite(expertId, row.email, row.full_name ?? "", row.permissions ?? []);
}

async function profileForToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await expertProfiles()
    .select("id, email, full_name, invite_expires_at, status")
    .eq("invite_token_hash", hashToken(token))
    .maybeSingle();
  const row = data as {
    id: string;
    email: string;
    full_name: string | null;
    invite_expires_at: string | null;
    status: string;
  } | null;
  if (!row || row.status !== "approved") return null;
  if (!row.invite_expires_at || new Date(row.invite_expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function inviteDetails(token: string) {
  const row = await profileForToken(token);
  return row ? { email: row.email, full_name: row.full_name } : null;
}

/** Set the guest's password and burn the link. */
export async function acceptInvite(token: string, password: string) {
  const row = await profileForToken(token);
  if (!row) throw new Error("This invite link is invalid or has expired. Ask HQ360 for a new one.");
  const { data: claimed } = await expertProfiles()
    .update({ invite_token_hash: null, invite_expires_at: null })
    .eq("id", row.id)
    .eq("invite_token_hash", hashToken(token))
    .select("id");
  if (!claimed?.length) throw new Error("This invite link was already used.");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(row.id, { password });
  if (error) throw new Error("Could not set your password. Ask HQ360 for a new link.");
  return { email: row.email };
}
