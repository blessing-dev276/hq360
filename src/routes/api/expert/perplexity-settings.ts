import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isExpertRequest, expertHasFeature } from "@/lib/expert-auth.server";
import { credentialDb, encryptExpertKey } from "@/lib/perplexity/credentials.server";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function perplexitySettings(request: Request) {
  const id = await isExpertRequest(request);
  if (!id) return json({ error: "Unauthorized" }, 401);
  if (!(await expertHasFeature(id, "scout")))
    return json({ error: "Scouting access is required." }, 403);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  try {
    if (request.method === "GET") {
      const { data, error } = await credentialDb()
        .select("updated_at")
        .eq("expert_id", id)
        .maybeSingle();
      if (error)
        return json(
          { error: "Could not load email search settings. Contact the administrator." },
          503,
        );
      return json({ configured: Boolean(data), updatedAt: data?.updated_at ?? null });
    }
    if (request.method === "DELETE") {
      const { error } = await credentialDb().delete().eq("expert_id", id);
      return error
        ? json({ error: "Could not remove your key." }, 503)
        : json({ configured: false });
    }
    const parsed = z
      .object({
        apiKey: z
          .string()
          .trim()
          .min(16)
          .max(512)
          .regex(/^pplx-[A-Za-z0-9_-]+$/, "Enter a valid Perplexity API key."),
      })
      .strict()
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return json({ error: "Enter a valid Perplexity API key starting with pplx-." }, 400);
    const { error } = await credentialDb().upsert(
      {
        expert_id: id,
        encrypted_key: encryptExpertKey(id, parsed.data.apiKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expert_id" },
    );
    return error
      ? json({ error: "Could not save your key. Contact the administrator." }, 503)
      : json({ configured: true });
  } catch {
    return json({ error: "Email search settings are unavailable. Please retry." }, 503);
  }
}
export const Route = createFileRoute("/api/expert/perplexity-settings")({
  server: {
    handlers: {
      GET: ({ request }) => perplexitySettings(request),
      PUT: ({ request }) => perplexitySettings(request),
      DELETE: ({ request }) => perplexitySettings(request),
    },
  },
});
