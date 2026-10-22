import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const saveSchema = z
  .object({
    provider: z.enum(["perplexity", "anthropic", "openai", "google"]),
    apiKey: z.string().trim().min(16).max(512),
  })
  .strict();

/** Settings → AI keys: the only place keys are set. Admin (x-hq360-actor:
 *  admin with an admin session) manages admin's keys; any approved expert,
 *  guests included, manages their own. Keys are never sent back. */
async function aiKeySettings(request: Request) {
  type Actor = import("@/lib/trackers/service.server").Actor;
  let actor: Actor | null = null;
  if (request.headers.get("x-hq360-actor") === "admin") {
    const { isAdminRequest } = await import("@/lib/admin-auth.server");
    if (await isAdminRequest(request)) actor = { role: "admin" };
  } else {
    const { isExpertRequest } = await import("@/lib/expert-auth.server");
    const expertId = await isExpertRequest(request);
    if (expertId) actor = { role: "expert", expertId };
  }
  if (!actor) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  const keys = await import("@/lib/trackers/ai-keys.server");
  try {
    if (request.method === "GET") {
      const reveal = new URL(request.url).searchParams.get("reveal");
      if (reveal === "perplexity" || reveal === "other")
        return json({ key: await keys.revealKey(actor, reveal) });
      const { aiUsage } = await import("@/lib/trackers/ai.server");
      const usage = await aiUsage(actor).catch(() => []);
      return json({ ...(await keys.aiKeyStatus(actor)), usage });
    }
    if (request.method === "DELETE") {
      const which = new URL(request.url).searchParams.get("key") === "other" ? "other" : "perplexity";
      await keys.deleteAiKey(actor, which);
      return json({ ok: true });
    }
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !keys.validProviderKey(parsed.data.provider, parsed.data.apiKey))
      return json(
        { error: "That does not look like a key for this provider. Check and paste it again." },
        400,
      );
    await keys.saveAiKey(actor, parsed.data.provider, parsed.data.apiKey);
    return json({ ok: true, lastFour: keys.lastFour(parsed.data.apiKey) });
  } catch {
    return json({ error: "AI settings are unavailable. Please try again." }, 503);
  }
}

export const Route = createFileRoute("/api/expert/ai-key")({
  server: {
    handlers: {
      GET: ({ request }) => aiKeySettings(request),
      PUT: ({ request }) => aiKeySettings(request),
      DELETE: ({ request }) => aiKeySettings(request),
    },
  },
});
