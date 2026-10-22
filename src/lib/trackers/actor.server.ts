import type { Actor } from "./service.server";

export const ADMIN_ACTOR_HEADER = "x-hq360-actor";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Who is calling the tracker APIs. The admin panel sends x-hq360-actor: admin,
 *  which counts only with a valid admin session; otherwise an approved
 *  (non guest) expert session is required. Writes must come from this site. */
export async function trackerActor(request: Request, write: boolean): Promise<Actor | Response> {
  let actor: Actor | null = null;
  if (request.headers.get(ADMIN_ACTOR_HEADER) === "admin") {
    const { isAdminRequest } = await import("@/lib/admin-auth.server");
    if (await isAdminRequest(request)) actor = { role: "admin" };
  } else {
    const { isExpertRequest } = await import("@/lib/expert-auth.server");
    const expertId = await isExpertRequest(request, { profileWrite: true });
    if (expertId) actor = { role: "expert", expertId };
  }
  if (!actor) return json({ error: "Unauthorized" }, 401);
  if (write && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  return actor;
}
