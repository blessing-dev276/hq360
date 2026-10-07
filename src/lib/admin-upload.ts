/**
 * Admin media upload.
 *
 * Fast path: shrink big images in the browser, then PUT the file straight to
 * Supabase Storage with a signed URL (no streaming through the server function).
 * Falls back to the buffered /api/admin/upload route if the signed flow fails.
 */

export type AdminBucket = "portfolio" | "team" | "work" | "testimonials" | "audit-evidence";
export type UploadResult = { url: string; mediaType: "image" | "video" };

const COMPRESSIBLE = /^image\/(png|jpe?g|webp)$/;
// Capped by width, not the longer side. A full-page website screenshot is
// tall (e.g. 1500x8000) — capping the longer side crushes the width down to
// a few hundred px trying to keep the huge height under the limit, which is
// what was making uploaded screenshots blurry. Height gets its own much
// higher ceiling, just to keep the canvas size sane for extreme captures.
const MAX_WIDTH = 2200;
const MAX_HEIGHT = 20000;
const WEBP_QUALITY = 0.94;
// Below this, a file is already a reasonable size for the web — re-encoding
// it only risks visible quality loss (especially on text-heavy screenshots)
// for a saving nobody would notice.
const SKIP_COMPRESSION_UNDER_BYTES = 2_000_000;

// Portraits (team + expert photos, "team" bucket) display at card size, so
// they don't need screenshot-grade settings: a 900px cap at normal photo
// quality turns a 2 MB PNG into ~40-80 KB with no visible difference.
const PORTRAIT = { maxWidth: 900, maxHeight: 1400, quality: 0.82, skipUnder: 150_000 };

async function compressImage(
  file: File,
  portrait = false,
): Promise<{ blob: Blob; type: string } | null> {
  if (typeof document === "undefined" || !COMPRESSIBLE.test(file.type)) return null;
  const maxWidth = portrait ? PORTRAIT.maxWidth : MAX_WIDTH;
  const maxHeight = portrait ? PORTRAIT.maxHeight : MAX_HEIGHT;
  const quality = portrait ? PORTRAIT.quality : WEBP_QUALITY;
  const skipUnder = portrait ? PORTRAIT.skipUnder : SKIP_COMPRESSION_UNDER_BYTES;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const noResizeNeeded = scale === 1;
    // Nothing to gain: already the right size and either already webp, or
    // small enough that re-encoding would only cost quality.
    if (noResizeNeeded && (file.type === "image/webp" || file.size < skipUnder)) {
      bitmap.close?.();
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Default smoothing quality is "low" in most browsers — visibly softer
    // than "high" when downscaling a large screenshot.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    return blob ? { blob, type: "image/webp" } : null;
  } catch {
    return null;
  }
}

async function fallbackUpload(
  file: Blob,
  name: string,
  bucket: AdminBucket,
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file instanceof File ? file : new File([file], name, { type: file.type }));
  fd.append("bucket", bucket);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    mediaType?: "image" | "video";
    error?: string;
  };
  if (!res.ok || !body.ok || !body.url) throw new Error(body.error || "upload_failed");
  return { url: body.url, mediaType: body.mediaType ?? "image" };
}

export async function uploadAdminMedia(file: File, bucket: AdminBucket): Promise<UploadResult> {
  const mediaType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";

  let payload: Blob = file;
  let contentType = file.type;
  const compressed = await compressImage(file, bucket === "team");
  if (compressed && compressed.blob.size < file.size) {
    payload = compressed.blob;
    contentType = compressed.type;
  }

  try {
    const res = await fetch("/api/admin/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket, contentType }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      uploadUrl?: string;
      publicUrl?: string;
      error?: string;
    };
    if (!res.ok || !body.ok || !body.uploadUrl || !body.publicUrl) {
      throw new Error(body.error || "upload_url_failed");
    }

    const put = await fetch(body.uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType, "x-upsert": "false" },
      body: payload,
    });
    if (!put.ok) throw new Error("upload_failed");

    return { url: body.publicUrl, mediaType };
  } catch {
    // Signed upload unavailable (e.g. storage misconfig) — use the buffered route.
    return fallbackUpload(payload, file.name || "upload", bucket);
  }
}

/** Shrink a portrait photo for upload (900px WebP); returns the original
 *  file if it's already small or can't be re-encoded. Used by expert photo
 *  uploads, which go straight to storage without the admin upload path. */
export async function compressPortrait(file: File): Promise<File> {
  const compressed = await compressImage(file, true);
  if (!compressed || compressed.blob.size >= file.size) return file;
  return new File([compressed.blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
    type: compressed.type,
  });
}
