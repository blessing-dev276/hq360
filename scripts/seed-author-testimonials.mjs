// One-off: migrate the hardcoded Authors review screenshots into the
// admin-managed portfolio system (industry_slug="authors") so they show via
// PortfolioStrip and can be edited/added-to from /admin > Portfolio, same as
// any other industry.
//
// Run once: `node --env-file=.env scripts/seed-author-testimonials.mjs`

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ITEMS = [
  {
    file: "src/assets/review-sanman.png",
    title: "sanman_thapa, five star review",
    description:
      "sanman_thapa praises the CRM workflow, email sequences and a lift in visibility and sales.",
  },
  {
    file: "src/assets/review-brandon.png",
    title: "Brandon, five star review",
    description: "Brandon reports a Best Seller list placement and twenty copies a day.",
  },
  {
    file: "src/assets/review-hmarkos.png",
    title: "hmarkos, five star review",
    description: "hmarkos notes significant movement on Goodreads Listopia lists.",
  },
  {
    file: "src/assets/review-dashboard.png",
    title: "Client dashboard, one month of sales",
    description: "Sales dashboard showing estimated royalties and processed orders in one month.",
  },
  {
    file: "src/assets/review-beverley.jpeg",
    title: "Beverley, five star review",
    description: "Beverley's five star review of the project.",
  },
];

const BUCKET = "portfolio";
const INDUSTRY_SLUG = "authors";
const CAPABILITY_SLUG = "visibility-reputation";

function extFor(file) {
  return path.extname(file).slice(1).toLowerCase();
}

function contentTypeFor(ext) {
  return ext === "jpeg" || ext === "jpg" ? "image/jpeg" : "image/png";
}

async function main() {
  // Place after any existing portfolio items.
  const { data: last } = await supabase
    .from("portfolio_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrder = (last?.sort_order ?? -1) + 1;

  for (const item of ITEMS) {
    const bytes = await readFile(item.file);
    const ext = extFor(item.file);
    const storagePath = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: contentTypeFor(ext), upsert: false });
    if (uploadError) {
      console.error(`[upload failed] ${item.file}:`, uploadError.message);
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from("portfolio_items").insert({
      title: item.title,
      description: item.description,
      media_type: "image",
      media_url: pub.publicUrl,
      capability_slug: CAPABILITY_SLUG,
      industry_slug: INDUSTRY_SLUG,
      published: true,
      sort_order: nextOrder++,
    });
    if (insertError) {
      console.error(`[insert failed] ${item.title}:`, insertError.message);
      continue;
    }

    console.log(`Seeded: ${item.title} -> ${pub.publicUrl}`);
  }
}

main();
