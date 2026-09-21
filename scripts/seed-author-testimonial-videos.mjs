// Publish the existing videos in the Authors section above FeaturedAuthor.
// Run: bun --env-file=.env scripts/seed-author-testimonial-videos.mjs
// Stable IDs and storage paths make this safe to rerun without duplicates.
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const videos = [
  { id: "24c25e9f-2666-461c-8507-b24698cfcac7", file: "testimonial-video-1-full.mp4" },
  { id: "a690fbd8-5cc8-4704-b131-4971d0631956", file: "testimonial-video-2.mp4" },
];

for (const [index, video] of videos.entries()) {
  const bytes = await readFile(new URL(`../src/assets/${video.file}`, import.meta.url));
  const storagePath = `authors/${video.file}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error: uploadError } = await supabase.storage
      .from("testimonials")
      .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (!uploadError) break;
    if (attempt === 3) throw uploadError;
    console.log(`Retrying upload: ${video.file}`);
  }

  const { data: media } = supabase.storage.from("testimonials").getPublicUrl(storagePath);
  const response = await fetch(media.publicUrl, { method: "HEAD" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("video/")) {
    throw new Error(`Video unavailable: ${video.file} (${response.status})`);
  }

  const { error: writeError } = await supabase.from("testimonials").upsert({
    id: video.id,
    title: `Author testimonial ${index + 1}`,
    media_type: "video",
    media_url: media.publicUrl,
    industry_slug: "authors",
    sort_order: index,
    published: true,
  });
  if (writeError) throw writeError;
  console.log(`Published and verified: ${video.file}`);
}
