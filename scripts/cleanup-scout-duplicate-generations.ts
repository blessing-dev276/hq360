// Read-only by default. --apply removes only duplicate expert batch memberships.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { asScoutDb } from "../src/lib/scout/db";
import {
  duplicateGenerations,
  type GenerationMembership,
} from "../src/lib/scout/duplicate-generations";
const db = asScoutDb(supabaseAdmin);

async function memberships() {
  const rows: GenerationMembership[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("scout_batch_books")
      .select(
        "batch_id, book_id, scout_batches!inner(owner, created_at), scout_discovered_books!inner(scout_author_id, scout_authors!inner(normalized_name))",
      )
      .neq("scout_batches.owner", "hq360")
      .order("batch_id")
      .order("book_id")
      .range(offset, offset + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data as unknown as GenerationMembership[]));
    if (data.length < 500) return rows;
  }
}

const rows = await memberships();
const duplicates = duplicateGenerations(rows);
const affected = new Set(duplicates.map((row) => row.scout_batches.owner));
const batchIds = [...new Set(duplicates.map((row) => row.batch_id))];
console.log(
  JSON.stringify({
    phase: "audit",
    generatedEntries: rows.length,
    duplicateEntries: duplicates.length,
    affectedExperts: affected.size,
    affectedBatches: batchIds.length,
  }),
);
if (!process.argv.includes("--apply") || !duplicates.length) process.exit(0);

const directory = resolve("backups.local");
await mkdir(directory, { recursive: true, mode: 0o700 });
const backup = resolve(
  directory,
  `scout-duplicate-generations-${new Date().toISOString().replaceAll(":", "-")}.json`,
);
// Full membership snapshot retains the surviving reference and every removal.
await writeFile(
  backup,
  JSON.stringify({ createdAt: new Date().toISOString(), rows, duplicates }, null, 2),
  { mode: 0o600, flag: "wx" },
);
console.log(JSON.stringify({ phase: "backup", path: backup }));
let removed = 0;
for (const batchId of batchIds) {
  const bookIds = duplicates.filter((row) => row.batch_id === batchId).map((row) => row.book_id);
  for (let offset = 0; offset < bookIds.length; offset += 100) {
    const { data, error } = await db
      .from("scout_batch_books")
      .delete()
      .eq("batch_id", batchId)
      .in("book_id", bookIds.slice(offset, offset + 100))
      .select("book_id");
    if (error)
      throw new Error(
        `Cleanup stopped after ${removed} removals: ${error.message}. Backup: ${backup}`,
      );
    removed += data.length;
  }
  const { count, error: countError } = await db
    .from("scout_batch_books")
    .select("book_id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  if (countError || count === null) throw new Error("Could not recount the cleaned batch.");
  const { error } = await db.from("scout_batches").update({ item_count: count }).eq("id", batchId);
  if (error) throw new Error(error.message);
}
const remaining = await memberships();
const remainingDuplicates = duplicateGenerations(remaining).length;
console.log(
  JSON.stringify({
    phase: "verified",
    removed,
    remainingEntries: remaining.length,
    remainingDuplicates,
    affectedExperts: affected.size,
    affectedBatches: batchIds.length,
  }),
);
if (remainingDuplicates)
  throw new Error("New duplicates remain; rerun the audit before another cleanup.");
