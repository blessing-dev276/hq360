import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "hq360_admin";
const SESSION_AGE_SECONDS = 60 * 60 * 12;

function configuredPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function configuredUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

export function adminConfigured(): boolean {
  return configuredPassword().length > 0;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedPassword = configuredPassword();
  if (!adminConfigured()) return false;
  return safeEqual(username.trim(), configuredUsername()) && safeEqual(password, expectedPassword);
}

function signature(expiresAt: string): string {
  return createHmac("sha256", configuredPassword()).update(expiresAt).digest("base64url");
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  if (!adminConfigured()) return false;
  const cookies = request.headers.get("cookie") ?? "";
  const raw = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return false;

  const [expiresAt, suppliedSignature] = raw.split(".");
  if (!expiresAt || !suppliedSignature || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(suppliedSignature, signature(expiresAt));
}

export async function sessionCookie(): Promise<string> {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${expiresAt}.${signature(expiresAt)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE_SECONDS}${secure}`;
}

export function clearCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
