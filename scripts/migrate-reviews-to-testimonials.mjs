// One-off: the 5 review screenshots were mistakenly seeded into
// portfolio_items (work samples). Move them into the new, distinct
// testimonials table instead.
//
// Run once: node --env-file=.env scripts/migrate-reviews-to-testimonials.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TITLES = [
  "sanman_thapa, five star review",
  "Brandon, five star review",
  "hmarkos, five star review",
  "Client dashboard, one month of sales",
  "Beverley, five star review",
];

async function main() {
  const { data: rows, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .in("title", TITLES);
  if (error) throw error;
  console.log(`Found ${rows.length} row(s) to move.`);

  let order = 0;
  for (const row of rows) {
    const { error: insertError } = await supabase.from("testimonials").insert({
      title: row.title,
      quote: row.description,
      media_url: row.media_url,
      industry_slug: row.industry_slug,
      capability_slug: null,
      sort_order: order++,
      published: row.published,
    });
    if (insertError) {
      console.error(`[insert failed] ${row.title}:`, insertError.message);
      continue;
    }
    const { error: deleteError } = await supabase
      .from("portfolio_items")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      console.error(`[delete failed] ${row.title}:`, deleteError.message);
      continue;
    }
    console.log(`Moved: ${row.title}`);
  }
}

main();
