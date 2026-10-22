import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { db } from "./service.server";

// Each expert's own AI provider key. AES-256-GCM with a server held master
// key (AI_KEY_MASTER_KEY, else derived from the service role key), bound to
// the expert id so one expert's ciphertext cannot be opened as another's.
// The plain key exists only in server memory for the length of one request.

export const AI_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const KEY_PATTERNS: Record<AiProvider, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  google: /^AIza[A-Za-z0-9_-]{30,}$/,
};
export function validProviderKey(provider: AiProvider, key: string) {
  return KEY_PATTERNS[provider].test(key.trim());
}

function masterKey(secret?: string) {
  const source =
    secret ?? (process.env.AI_KEY_MASTER_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!source?.trim()) throw new Error("AI key encryption is not configured.");
  return Buffer.from(hkdfSync("sha256", source.trim(), "hq360-expert-ai-keys-v1", "ai-provider", 32));
}

export function encryptAiKey(expertId: string, key: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(secret), iv);
  cipher.setAAD(Buffer.from(`ai:${expertId}`));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptAiKey(expertId: string, stored: string, secret?: string) {
  const [version, iv, tag, encrypted] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid stored key.");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(secret), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(`ai:${expertId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export const lastFour = (key: string) => key.trim().slice(-4);

/** What the browser may know: provider, last four characters, when saved. */
export async function aiKeyStatus(expertId: string) {
  const { data, error } = await db()
    .from("expert_ai_credentials")
    .select("provider, last_four, updated_at")
    .eq("expert_id", expertId)
    .maybeSingle();
  if (error) throw new Error("AI settings are unavailable.");
  return data
    ? { configured: true, provider: data.provider as AiProvider, lastFour: data.last_four as string, updatedAt: data.updated_at as string }
    : { configured: false as const };
}

export async function saveAiKey(expertId: string, provider: AiProvider, key: string) {
  const { error } = await db()
    .from("expert_ai_credentials")
    .upsert(
      {
        expert_id: expertId,
        provider,
        encrypted_key: encryptAiKey(expertId, key.trim()),
        last_four: lastFour(key),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expert_id" },
    );
  if (error) throw new Error("Could not save your key.");
}

export async function deleteAiKey(expertId: string) {
  const { error } = await db().from("expert_ai_credentials").delete().eq("expert_id", expertId);
  if (error) throw new Error("Could not remove your key.");
}

/** Server only. Loads this expert's key and no one else's; there is no fallback key. */
export async function loadAiKey(expertId: string): Promise<{ provider: AiProvider; key: string } | null> {
  const { data, error } = await db()
    .from("expert_ai_credentials")
    .select("provider, encrypted_key")
    .eq("expert_id", expertId)
    .maybeSingle();
  if (error) throw new Error("AI settings are unavailable.");
  if (!data) return null;
  return { provider: data.provider as AiProvider, key: decryptAiKey(expertId, data.encrypted_key as string) };
}
