// Publish the book interior sample under both Writing & Translation and Authors.
// Run: bun --env-file=.env scripts/seed-book-interior-portfolio.mjs
// Safe to rerun: the stable ID prevents duplicate portfolio entries.
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const id = "0e427a93-9bb0-4cc3-9cb0-43872364e1fc";
const storagePath = "samples/book-interior-formatting.jpg";
const bytes = await readFile(
  new URL("../public/media/portfolio/book-interior-formatting.jpg", import.meta.url),
);
const { error: uploadError } = await supabase.storage.from("portfolio").upload(storagePath, bytes, {
  contentType: "image/jpeg",
  upsert: true,
});
if (uploadError) throw uploadError;

const { data: media } = supabase.storage.from("portfolio").getPublicUrl(storagePath);
const { error: writeError } = await supabase.from("portfolio_items").upsert({
  id,
  title: "Book interior formatting & layout",
  description:
    "Book interior samples featuring chapter openings, drop caps, running headers and page numbering across fiction and nonfiction layouts.",
  media_type: "image",
  media_url: media.publicUrl,
  capability_slug: "writing-translation",
  industry_slug: "authors",
  published: true,
});
if (writeError) throw writeError;

for (const [column, slug] of [
  ["capability_slug", "writing-translation"],
  ["industry_slug", "authors"],
]) {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("id")
    .eq("published", true)
    .eq(column, slug)
    .eq("id", id)
    .single();
  if (error || !data) throw error ?? new Error(`Sample missing from ${slug}.`);
  console.log(`Verified portfolio sample in ${slug}.`);
}

const response = await fetch(media.publicUrl);
if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
  throw new Error(`Portfolio image unavailable: ${response.status}`);
}
console.log("Verified public portfolio image.");
