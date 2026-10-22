import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";

// Passcodes, links, unlock cookies and anonymous visitor hashes for client
// tracking pages. Nothing here stores or logs a passcode or a raw IP address.

export const BCRYPT_COST = 12;
export const UNLOCK_DAYS = 30;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

/** Case, spaces and hyphens do not matter: "belfast-7342" opens BELFAST7342. */
export function normalisePasscode(input: string) {
  return input.normalize("NFKC").toUpperCase().replace(/[\s-]+/g, "");
}

export function validPasscode(input: string) {
  const value = normalisePasscode(input);
  return value.length >= 6 && value.length <= 64 && /^[A-Z0-9]+$/.test(value);
}

export async function hashPasscode(input: string, cost = BCRYPT_COST) {
  if (!validPasscode(input)) throw new Error("Use 6 to 64 letters and numbers.");
  return hash(normalisePasscode(input), cost);
}

export async function verifyPasscode(input: string, stored: string | null) {
  if (!stored || !input) return false;
  return compare(normalisePasscode(input), stored);
}

// Short, plain words that read well in an email: WORD-1234.
const WORDS = [
  "AMBER", "ANCHOR", "ASPEN", "BEACON", "BIRCH", "BRIDGE", "CANYON", "CEDAR", "CIRCLE",
  "CLOVER", "COMET", "CORAL", "DELTA", "EMBER", "FALCON", "FJORD", "FOREST", "GARNET",
  "HARBOR", "HAZEL", "HERON", "ISLAND", "JASPER", "LANTERN", "LAUREL", "MAPLE", "MEADOW",
  "MERLIN", "NORTH", "OAKLEY", "OCEAN", "ORCHARD", "PEBBLE", "PILOT", "QUARRY", "RAVEN",
  "RIVER", "ROBIN", "SAFFRON", "SPRUCE", "SUMMIT", "THISTLE", "TIMBER", "VALLEY", "WILLOW",
];
export function generatePasscode() {
  return `${WORDS[randomInt(WORDS.length)]}-${String(randomInt(10000)).padStart(4, "0")}`;
}

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function clientSlugBase(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "client";
}
/** {client-slug}-{4 random characters}, e.g. hugh-murphy-7k2q. */
export function trackerSlug(name: string, suffix?: string) {
  const random =
    suffix ?? Array.from({ length: 4 }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join("");
  if (!/^[a-z0-9]{4}$/.test(random)) throw new Error("The link ending must be 4 letters or numbers.");
  return `${clientSlugBase(name)}-${random}`;
}

function serverSecret(secret = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!secret?.trim()) throw new Error("Tracker security is not configured.");
  return secret.trim();
}
const mac = (secret: string | undefined, purpose: string, value: string) =>
  createHmac("sha256", serverSecret(secret)).update(`hq360-tracker:${purpose}:${value}`);

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const unlockCookieName = (trackerId: string) => `hq360_track_${trackerId.replace(/-/g, "")}`;

/** Signed cookie value: tracker, passcode version and expiry. Resetting the
 *  passcode bumps the version, which signs out every device at once. */
export function unlockCookieValue(
  trackerId: string,
  passcodeVersion: number,
  now = Date.now(),
  secret?: string,
) {
  const expires = Math.floor(now / 1000) + UNLOCK_DAYS * 86400;
  const payload = `${passcodeVersion}.${expires}`;
  return `${payload}.${mac(secret, "unlock", `${trackerId}.${payload}`).digest("base64url")}`;
}

export function unlockCookieHeader(trackerId: string, value: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${unlockCookieName(trackerId)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${UNLOCK_DAYS * 86400}${secure}`;
}

export function isUnlocked(
  cookieHeader: string,
  trackerId: string,
  passcodeVersion: number,
  now = Date.now(),
  secret?: string,
) {
  const name = `${unlockCookieName(trackerId)}=`;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name))
    ?.slice(name.length);
  if (!raw) return false;
  const [version, expires, signature] = raw.split(".");
  if (!version || !expires || !signature || !/^\d+$/.test(version) || !/^\d+$/.test(expires))
    return false;
  if (Number(version) !== passcodeVersion || Number(expires) <= Math.floor(now / 1000)) return false;
  const expected = mac(secret, "unlock", `${trackerId}.${version}.${expires}`).digest(
    "base64url",
  );
  return safeEqual(signature, expected);
}

/** The visitor's network address as seen by the edge. Used only as HMAC input. */
export function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Unique visitors: rotates every UTC day, so devices cannot be followed over time. */
export function dailyVisitorHash(request: Request, trackerId: string, now = new Date(), secret?: string) {
  const day = now.toISOString().slice(0, 10);
  const agent = request.headers.get("user-agent") ?? "";
  return mac(secret, "visitor", `${day}|${trackerId}|${clientAddress(request)}|${agent}`).digest(
    "hex",
  );
}

/** Lockout key: stable for the 15 minute lock, still never the address itself. */
export function lockoutKey(request: Request, trackerId: string, secret?: string) {
  return mac(secret, "lockout", `${trackerId}|${clientAddress(request)}`).digest("hex");
}

export function userAgentFamily(agent: string | null) {
  const ua = agent ?? "";
  if (!ua) return "Unknown";
  if (/bot|crawl|spider|preview/i.test(ua)) return "Bot";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return /Mobile/.test(ua) ? "Chrome Mobile" : "Chrome";
  if (/Safari\//.test(ua)) return /Mobile/.test(ua) ? "Safari Mobile" : "Safari";
  return "Other";
}

export function visitorCountry(request: Request) {
  const value = request.headers.get("cf-ipcountry")?.toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1" ? value : null;
}
