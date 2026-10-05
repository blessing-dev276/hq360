import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Signed upload URL for the signed-in expert's own portrait folder. */
export const Route = createFileRoute("/api/expert/photo-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = z
          .object({ contentType: z.enum(["image/png", "image/jpeg", "image/webp"]) })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Use a PNG, JPG or WebP image." }, 415);
        const path = `${expertId}/${crypto.randomUUID()}.${EXT[parsed.data.contentType]}`;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const bucket = supabaseAdmin.storage.from("expert-photos");
          const { data, error } = await bucket.createSignedUploadUrl(path);
          if (error || !data) return json({ error: "Photo storage is unavailable." }, 503);
          const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
          return json({
            // storage-js may return a full URL or a path; resolve either against base.
            uploadUrl: new URL(data.signedUrl, base).href,
            publicUrl: bucket.getPublicUrl(path).data.publicUrl,
          });
        } catch {
          return json({ error: "Photo storage is unavailable." }, 503);
        }
      },
    },
  },
});
