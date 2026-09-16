import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — larger assets should be hosted elsewhere and added by URL
const ALLOWED = /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

function extFor(type: string): string {
  const map: Record<string, string> = {
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
  return map[type] ?? "bin";
}

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);

        let file: File | null = null;
        let bucket: "portfolio" | "team" | "work" | "testimonials" | "audit-evidence" = "portfolio";
        try {
          const form = await request.formData();
          const f = form.get("file");
          if (f instanceof File) file = f;
          const b = form.get("bucket");
          if (b === "team" || b === "work" || b === "testimonials" || b === "audit-evidence")
            bucket = b;
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        if (!file) return json({ ok: false, error: "no_file" }, 400);
        if (!ALLOWED.test(file.type)) return json({ ok: false, error: "unsupported_type" }, 415);
        if (file.size > MAX_BYTES)
          return json({ ok: false, error: "too_large", maxBytes: MAX_BYTES }, 413);

        const mediaType = file.type.startsWith("video/") ? "video" : "image";
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extFor(file.type)}`;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(path, bytes, { contentType: file.type, upsert: false });
          if (error) {
            console.error("[admin/upload] storage", error.message);
            return json({ ok: false, error: "storage" }, 500);
          }
          const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
          return json({ ok: true, url: data.publicUrl, mediaType });
        } catch (err) {
          console.error("[admin/upload]", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
