import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Admin view of one expert's Perplexity key: see whether one is saved, set or
// replace it, or remove it. The key is encrypted and never sent back.
async function handle(request: Request, expertId: string) {
  const { isAdminRequest } = await import("@/lib/admin-auth.server");
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
  if (!/^[0-9a-f-]{36}$/.test(expertId)) return json({ error: "Expert not found." }, 404);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  const { credentialDb, encryptExpertKey } = await import("@/lib/perplexity/credentials.server");
  if (request.method === "GET") {
    const { data, error } = await credentialDb()
      .select("updated_at")
      .eq("expert_id", expertId)
      .maybeSingle();
    if (error) return json({ error: "Could not load the key settings." }, 503);
    return json({ configured: Boolean(data), updatedAt: data?.updated_at ?? null });
  }
  if (request.method === "DELETE") {
    const { error } = await credentialDb().delete().eq("expert_id", expertId);
    return error ? json({ error: "Could not remove the key." }, 503) : json({ configured: false });
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
    return json({ error: "Enter a valid Perplexity API key starting with pplx-." }, 400);
  const updatedAt = new Date().toISOString();
  const { error } = await credentialDb().upsert(
    {
      expert_id: expertId,
      encrypted_key: encryptExpertKey(expertId, parsed.data.apiKey),
      updated_at: updatedAt,
    },
    { onConflict: "expert_id" },
  );
  return error
    ? json({ error: "Could not save the key." }, 503)
    : json({ configured: true, updatedAt });
}

export const Route = createFileRoute("/api/admin/experts/$id/perplexity-key")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params.id),
      PUT: ({ request, params }) => handle(request, params.id),
      DELETE: ({ request, params }) => handle(request, params.id),
    },
  },
});
