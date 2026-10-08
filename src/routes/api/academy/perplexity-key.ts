import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// A trainer's own Perplexity key for the Practice Room AI. Write only: the key
// is encrypted on save and never returned to the browser.
async function handle(request: Request) {
  const a = await import("@/lib/academy/academy.server");
  const { encryptExpertKey } = await import("@/lib/perplexity/credentials.server");
  const viewer = await a.getViewer(request);
  if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
  if (viewer.role !== "trainer") return a.json({ ok: false, error: "forbidden" }, 403);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return a.json({ ok: false, error: "origin" }, 403);
  const table = () => a.db.from("academy_trainer_credentials");
  if (request.method === "GET") {
    const { data, error } = await table()
      .select("updated_at")
      .eq("trainer_id", viewer.id)
      .maybeSingle();
    if (error) return a.json({ ok: false, message: "Could not load your key settings." }, 503);
    return a.json({ ok: true, configured: Boolean(data), updatedAt: data?.updated_at ?? null });
  }
  if (request.method === "DELETE") {
    const { error } = await table().delete().eq("trainer_id", viewer.id);
    return error
      ? a.json({ ok: false, message: "Could not remove your key." }, 503)
      : a.json({ ok: true, configured: false });
  }
  const parsed = z
    .object({
      apiKey: z
        .string()
        .trim()
        .min(16)
        .max(512)
        .regex(/^pplx-[A-Za-z0-9_-]+$/),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return a.json(
      { ok: false, message: "Enter a valid Perplexity API key starting with pplx-." },
      400,
    );
  const { error } = await table().upsert(
    {
      trainer_id: viewer.id,
      encrypted_key: encryptExpertKey(`academy:${viewer.id}`, parsed.data.apiKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trainer_id" },
  );
  return error
    ? a.json({ ok: false, message: "Could not save your key." }, 503)
    : a.json({ ok: true, configured: true });
}

export const Route = createFileRoute("/api/academy/perplexity-key")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
    },
  },
});
