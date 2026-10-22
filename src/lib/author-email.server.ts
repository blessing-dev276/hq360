import { isAdminRequest } from "./admin-auth.server";
import { authorEmailSchema } from "./author-email";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function authorEmailConfig() {
  const replyTo = process.env.AUTHOR_EMAIL_REPLY_TO?.trim() || "";
  return {
    ready:
      process.env.EMAIL_PROVIDER?.toLowerCase() === "resend" &&
      !!process.env.RESEND_API_KEY &&
      !!process.env.EMAIL_FROM &&
      authorEmailSchema.shape.to.safeParse(replyTo).success,
    from: process.env.EMAIL_FROM || "Not configured",
    replyTo,
  };
}
export async function handleAuthorEmail(request: Request) {
  if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
  const config = authorEmailConfig();
  if (request.method === "GET") return json(config);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  if (!config.ready)
    return json(
      { error: "Configure Resend, EMAIL_FROM and AUTHOR_EMAIL_REPLY_TO before sending." },
      503,
    );
  const raw = await request.text();
  if (raw.length > 30000) return json({ error: "Email is too large." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = authorEmailSchema.safeParse(body);
  if (!parsed.success)
    return json({ error: parsed.error.issues[0]?.message || "Check the email." }, 400);
  const { sendTrackedOutreach } = await import("./author-outreach.server");
  return sendTrackedOutreach(parsed.data, config);
}
