import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ALLOWED = /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const schema = z.object({
  bucket: z.enum(["portfolio", "team", "work", "testimonials"]),
  contentType: z.string().min(1).max(120),
});

/**
 * Issues a short-lived signed upload URL so the browser can send the file
 * straight to Supabase Storage instead of streaming it through this function.
 * Removes the double hop that made large uploads slow.
 */
export const Route = createFileRoute("/api/admin/upload-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);

        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        if (!ALLOWED.test(body.contentType))
          return json({ ok: false, error: "unsupported_type" }, 415);

        const ext = EXT[body.contentType] ?? "bin";
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage
            .from(body.bucket)
            .createSignedUploadUrl(path);
          if (error || !data) {
            console.error("[admin/upload-url]", error?.message);
            return json({ ok: false, error: "storage" }, 500);
          }
          const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
          const { data: pub } = supabaseAdmin.storage.from(body.bucket).getPublicUrl(path);
          return json({
            ok: true,
            path,
            token: data.token,
            uploadUrl: `${base}${data.signedUrl}`,
            publicUrl: pub.publicUrl,
          });
        } catch (err) {
          console.error("[admin/upload-url]", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
