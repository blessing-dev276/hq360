import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const saveSchema = z
  .object({
    provider: z.enum(["anthropic", "openai", "google"]),
    apiKey: z.string().trim().min(20).max(512),
  })
  .strict();

/** Settings, AI: the expert's own provider key. GET never returns the key,
 *  only the provider and its last four characters. */
async function aiKeySettings(request: Request) {
  // Experts manage their own key; admin (x-hq360-actor: admin) manages admin's own key.
  const { trackerActor } = await import("@/lib/trackers/actor.server");
  const actor = await trackerActor(request, request.method !== "GET");
  if (actor instanceof Response) return actor;
  const keys = await import("@/lib/trackers/ai-keys.server");
  try {
    if (request.method === "GET") {
      const { aiUsage } = await import("@/lib/trackers/ai.server");
      return json({ ...(await keys.aiKeyStatus(actor)), usage: await aiUsage(actor) });
    }
    if (request.method === "DELETE") {
      await keys.deleteAiKey(actor);
      return json({ configured: false });
    }
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !keys.validProviderKey(parsed.data.provider, parsed.data.apiKey))
      return json({ error: "That does not look like a key for this provider. Check and paste it again." }, 400);
    await keys.saveAiKey(actor, parsed.data.provider, parsed.data.apiKey);
    return json({ configured: true, provider: parsed.data.provider, lastFour: keys.lastFour(parsed.data.apiKey) });
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
