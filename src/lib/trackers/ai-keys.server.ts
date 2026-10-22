import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { db, type Actor } from "./service.server";

// One place for every AI key: Settings. Perplexity keys live in the
// expert/admin_perplexity_credentials tables that Scouting, Audit research and
// the Academy already read, so a key saved once works across the app. An
// optional Claude/OpenAI/Gemini key (AES-256-GCM, bound to its owner) lives in
// expert/admin_ai_credentials and is used only when no Perplexity key is set.

export const AI_PROVIDERS = ["perplexity", "anthropic", "openai", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
export const OTHER_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type OtherProvider = (typeof OTHER_PROVIDERS)[number];

const KEY_PATTERNS: Record<AiProvider, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  google: /^AIza[A-Za-z0-9_-]{30,}$/,
  perplexity: /^pplx-[A-Za-z0-9_-]{12,}$/,
};
export function validProviderKey(provider: AiProvider, key: string) {
  return KEY_PATTERNS[provider].test(key.trim());
}

function masterKey(secret?: string) {
  const source =
    secret ??
    (process.env.AI_KEY_MASTER_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!source?.trim()) throw new Error("AI key encryption is not configured.");
  return Buffer.from(
    hkdfSync("sha256", source.trim(), "hq360-expert-ai-keys-v1", "ai-provider", 32),
  );
}

export function encryptAiKey(expertId: string, key: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(secret), iv);
  cipher.setAAD(Buffer.from(`ai:${expertId}`));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptAiKey(expertId: string, stored: string, secret?: string) {
  const [version, iv, tag, encrypted] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid stored key.");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(secret), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(`ai:${expertId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export const lastFour = (key: string) => key.trim().slice(-4);

const ownerId = (actor: Actor) => (actor.role === "expert" ? actor.expertId : "admin");

function otherStore(actor: Actor) {
  return actor.role === "expert"
    ? { table: "expert_ai_credentials", column: "expert_id", id: actor.expertId }
    : { table: "admin_ai_credentials", column: "id", id: "admin" };
}

async function perplexityStore(actor: Actor) {
  const c = await import("@/lib/perplexity/credentials.server");
  return actor.role === "expert"
    ? { table: c.credentialDb, column: "expert_id", id: actor.expertId, c }
    : { table: c.adminCredentialDb, column: "id", id: "admin", c };
}

export type AiKeyStatus = {
  perplexity: { configured: boolean; updatedAt: string | null; masked: string | null };
  other:
    | { configured: false }
    | {
        configured: true;
        provider: OtherProvider;
        lastFour: string;
        masked: string;
        updatedAt: string;
      };
};

/** What the browser may know: whether each key is saved, never the key. */
export async function aiKeyStatus(actor: Actor): Promise<AiKeyStatus> {
  const p = await perplexityStore(actor);
  const o = otherStore(actor);
  const [pplx, other] = await Promise.all([
    p.table().select("updated_at").eq(p.column, p.id).maybeSingle(),
    db().from(o.table).select("provider, last_four, updated_at").eq(o.column, o.id).maybeSingle(),
  ]);
  if (pplx.error) throw new Error("AI settings are unavailable.");
  const pplxKey = pplx.data ? await revealKey(actor, "perplexity").catch(() => null) : null;
  return {
    perplexity: {
      configured: Boolean(pplx.data),
      updatedAt: pplx.data?.updated_at ?? null,
      masked: pplxKey ? maskKey(pplxKey) : null,
    },
    // The optional-provider table is newer; a missing table must not hide Perplexity.
    other:
      other.data && !other.error
        ? {
            configured: true,
            provider: other.data.provider as OtherProvider,
            lastFour: other.data.last_four as string,
            masked: `${"•".repeat(8)}${other.data.last_four as string}`,
            updatedAt: other.data.updated_at as string,
          }
        : { configured: false },
  };
}

export async function saveAiKey(actor: Actor, provider: AiProvider, key: string) {
  const updated_at = new Date().toISOString();
  if (provider === "perplexity") {
    const p = await perplexityStore(actor);
    const { error } = await p
      .table()
      .upsert(
        { [p.column]: p.id, encrypted_key: p.c.encryptExpertKey(p.id, key.trim()), updated_at },
        { onConflict: p.column },
      );
    if (error) throw new Error("Could not save your key.");
    return;
  }
  const o = otherStore(actor);
  const { error } = await db()
    .from(o.table)
    .upsert(
      {
        [o.column]: o.id,
        provider,
        encrypted_key: encryptAiKey(o.id, key.trim()),
        last_four: lastFour(key),
        updated_at,
      },
      { onConflict: o.column },
    );
  if (error) throw new Error("Could not save your key.");
}

export async function deleteAiKey(actor: Actor, which: "perplexity" | "other") {
  if (which === "perplexity") {
    const p = await perplexityStore(actor);
    const { error } = await p.table().delete().eq(p.column, p.id);
    if (error) throw new Error("Could not remove your key.");
    return;
  }
  const o = otherStore(actor);
  const { error } = await db().from(o.table).delete().eq(o.column, o.id);
  if (error) throw new Error("Could not remove your key.");
}

export function maskKey(key: string) {
  const k = key.trim();
  const prefix = k.match(/^(pplx-|sk-ant-|sk-|AIza)/)?.[0] ?? "";
  return `${prefix}${"•".repeat(8)}${k.slice(-4)}`;
}

/** The owner's own saved key in full, for Settings → Show. */
export async function revealKey(actor: Actor, which: "perplexity" | "other") {
  if (which === "perplexity") {
    const p = await perplexityStore(actor);
    return actor.role === "expert" ? p.c.loadExpertKey(actor.expertId) : p.c.loadAdminKey();
  }
  const o = otherStore(actor);
  const { data } = await db()
    .from(o.table)
    .select("encrypted_key")
    .eq(o.column, o.id)
    .maybeSingle();
  return data ? decryptAiKey(ownerId(actor), data.encrypted_key as string) : null;
}

/** Server only. This actor's own key, Perplexity first; no one else's key is used. */
export async function loadAiKey(actor: Actor): Promise<{ provider: AiProvider; key: string } | null> {
  const p = await perplexityStore(actor);
  const pplx =
    actor.role === "expert" ? await p.c.loadExpertKey(actor.expertId) : await p.c.loadAdminKey();
  if (pplx) return { provider: "perplexity", key: pplx };
  const o = otherStore(actor);
  const { data, error } = await db()
    .from(o.table)
    .select("provider, encrypted_key")
    .eq(o.column, o.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    provider: data.provider as AiProvider,
    key: decryptAiKey(ownerId(actor), data.encrypted_key as string),
  };
}
