import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PerplexityError } from "./agent.server";
import type { StaffAccess } from "@/lib/expert-auth.server";

// Existing server-only secret; HKDF separates encryption from session signing.
// Rotating this secret requires re-encrypting credentials or re-entering keys.
function encryptionKey(secret = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!secret?.trim()) throw new Error("Credential encryption is not configured.");
  return Buffer.from(
    hkdfSync("sha256", secret.trim(), "hq360-expert-credentials-v1", "perplexity", 32),
  );
}
export function encryptExpertKey(expertId: string, key: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(expertId));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}
export function decryptExpertKey(expertId: string, stored: string, secret?: string) {
  const [version, iv, tag, encrypted] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid stored credential.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(iv, "base64"),
  );
  decipher.setAAD(Buffer.from(expertId));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
export const credentialDb = () =>
  (supabaseAdmin as SupabaseClient).from("expert_perplexity_credentials");
export const adminCredentialDb = () =>
  (supabaseAdmin as SupabaseClient).from("admin_perplexity_credentials");
export async function loadAdminKey(): Promise<string | null> {
  const { data, error } = await adminCredentialDb()
    .select("encrypted_key")
    .eq("id", "admin")
    .maybeSingle();
  if (error) throw new PerplexityError("Admin email search settings are unavailable.", 503);
  if (!data) return null;
  try {
    return decryptExpertKey("admin", data.encrypted_key);
  } catch {
    throw new PerplexityError("Replace the admin key in Scouting → Email search settings.", 503);
  }
}
export async function adminKeyForResearch(load = loadAdminKey) {
  const key = (await load()) || process.env.PERPLEXITY_API_KEY?.trim();
  if (!key)
    throw new PerplexityError(
      "Add a Perplexity API key in Scouting → Email search settings or set PERPLEXITY_API_KEY on the server.",
      503,
    );
  return key;
}
export async function loadExpertKey(expertId: string): Promise<string | null> {
  const { data, error } = await credentialDb()
    .select("encrypted_key")
    .eq("expert_id", expertId)
    .maybeSingle();
  if (error)
    throw new PerplexityError(
      "Email search settings are unavailable. Please contact the administrator.",
      503,
    );
  if (!data) return null;
  try {
    return decryptExpertKey(expertId, data.encrypted_key);
  } catch {
    throw new PerplexityError(
      "Your saved key could not be opened. Replace it in Scouting → Email search settings.",
      503,
    );
  }
}
export async function keyForSearch(access: StaffAccess, load = loadExpertKey) {
  if (access.role === "admin") return adminKeyForResearch();
  const key = await load(access.expertId);
  if (!key)
    throw new PerplexityError(
      "Add your own Perplexity API key in Scouting → Email search settings to search for author emails. Your Perplexity account pays for your searches.",
      409,
    );
  return key;
}
