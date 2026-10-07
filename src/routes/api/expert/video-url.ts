import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/expert-testimonials";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const EXT: Record<(typeof VIDEO_TYPES)[number], string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Signed upload URL for a testimonial video in the expert's own folder. */
export const Route = createFileRoute("/api/expert/video-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = z
          .object({
            contentType: z.enum(VIDEO_TYPES),
            size: z.number().int().positive().max(VIDEO_MAX_BYTES),
          })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: "Use an MP4, WebM or MOV video up to 50 MB." }, 415);
        const path = `${expertId}/${crypto.randomUUID()}.${EXT[parsed.data.contentType]}`;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const bucket = supabaseAdmin.storage.from("expert-videos");
          const { data, error } = await bucket.createSignedUploadUrl(path);
          if (error || !data) return json({ error: "Video storage is unavailable." }, 503);
          const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
          return json({
            uploadUrl: new URL(data.signedUrl, base).href,
            publicUrl: bucket.getPublicUrl(path).data.publicUrl,
          });
        } catch {
          return json({ error: "Video storage is unavailable." }, 503);
        }
      },
    },
  },
});
