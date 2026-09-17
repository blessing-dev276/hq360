import { createHash, randomBytes } from "node:crypto";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizeCode = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const makeCode = (name: string) =>
  `${
    (name.split(/\s/)[0] ?? "AUTHOR")
      .replace(/[^a-z]/gi, "")
      .slice(0, 8)
      .toUpperCase() || "AUTHOR"
  }-${randomBytes(6).toString("hex").toUpperCase()}`;
export function accessActive(
  access: {
    access_enabled: boolean;
    revoked_at: string | null;
    expires_at: string | null;
    version_id: string | null;
  },
  now = Date.now(),
) {
  return (
    access.access_enabled &&
    !access.revoked_at &&
    Boolean(access.version_id) &&
    (!access.expires_at || Date.parse(access.expires_at) > now)
  );
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
