// Recreate Hugh Murphy's tracker (spec section 7) as the first dashboard tracker.
//
// Run, after the tracker migrations are applied:
//   HUGH_PASSCODE='<his current passcode>' bun --env-file=.env scripts/seed-hugh-tracker.ts \
//     --expert-email <Emmanuel's expert login email> --files <folder with the unzipped hugh-tracker-site files>
//
// The passcode is read from the environment and stored only as a bcrypt hash;
// it never appears in this repository. Refuses to run twice (the slug is unique).
import { createClient } from "@supabase/supabase-js";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildSnapshot, type TrackerFileRow, type TrackerItemRow } from "../src/lib/trackers/core";
import { HUGH_FILE_NAMES, HUGH_ITEMS, HUGH_LOG, HUGH_TRACKER } from "../src/lib/trackers/hugh-seed";
import { hashPasscode, trackerSlug, validPasscode } from "../src/lib/trackers/security.server";

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const passcode = process.env.HUGH_PASSCODE ?? "";
const expertEmail = arg("expert-email");
const filesDir = arg("files");
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
if (!validPasscode(passcode)) throw new Error("Set HUGH_PASSCODE to Hugh's current passcode.");
if (!expertEmail || !filesDir) throw new Error("Pass --expert-email and --files.");

for (const name of HUGH_FILE_NAMES) await stat(join(filesDir, name)); // fail early if a file is missing

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: expert, error: expertError } = await supabase
  .from("expert_profiles")
  .select("id, full_name, email")
  .eq("email", expertEmail.toLowerCase())
  .maybeSingle();
if (expertError || !expert) throw new Error(`No expert profile for ${expertEmail}.`);

const slug = trackerSlug(HUGH_TRACKER.clientName, HUGH_TRACKER.slugSuffix);
const { data: tracker, error: trackerError } = await supabase
  .from("client_trackers")
  .insert({
    expert_id: expert.id,
    client_name: HUGH_TRACKER.clientName,
    project_title: HUGH_TRACKER.projectTitle,
    package_name: HUGH_TRACKER.packageName,
    slug,
    passcode_hash: await hashPasscode(passcode),
  })
  .select("id")
  .single();
if (trackerError) throw new Error(`Could not create the tracker (already seeded?): ${trackerError.message}`);

const items: TrackerItemRow[] = [];
const files: TrackerFileRow[] = [];
for (const [position, seed] of HUGH_ITEMS.entries()) {
  const { data: item, error } = await supabase
    .from("tracker_items")
    .insert({
      tracker_id: tracker.id,
      position,
      title: seed.title,
      status: seed.status,
      progress: seed.progress,
      description: seed.description,
      is_free_bonus: seed.is_free_bonus,
      blocks: seed.blocks,
    })
    .select("id, position, title, status, progress, description, is_free_bonus, blocks")
    .single();
  if (error) throw error;
  const blocks = { ...seed.blocks };
  for (const [filePosition, file] of seed.files.entries()) {
    const bytes = await readFile(join(filesDir, file.name));
    const storageKey = `${expert.id}/${tracker.id}/${crypto.randomUUID()}${file.name.slice(file.name.lastIndexOf("."))}`;
    const upload = await supabase.storage
      .from("tracker-files")
      .upload(storageKey, bytes, { contentType: file.contentType, upsert: false });
    if (upload.error) throw upload.error;
    const kind = file.contentType.startsWith("image/") ? "image" : file.contentType.startsWith("video/") ? "video" : "pdf";
    const { data: row, error: fileError } = await supabase
      .from("tracker_files")
      .insert({
        tracker_id: tracker.id,
        item_id: item.id,
        kind,
        storage_key: storageKey,
        filename: file.name,
        size: bytes.byteLength,
        content_type: file.contentType,
        position: filePosition,
      })
      .select("id, item_id, kind, filename, size, position")
      .single();
    if (fileError) throw fileError;
    files.push(row as TrackerFileRow);
    if (file.highlight && blocks.highlight) blocks.highlight = { ...blocks.highlight, imageFileId: row.id };
  }
  if (blocks.highlight?.imageFileId) await supabase.from("tracker_items").update({ blocks }).eq("id", item.id);
  items.push({ ...(item as TrackerItemRow), blocks });
}

// Insert oldest first so created_at keeps today's order within each date.
const log = [];
for (const entry of [...HUGH_LOG].reverse()) {
  const { data, error } = await supabase
    .from("tracker_log_entries")
    .insert({ tracker_id: tracker.id, entry_date: entry.date, text: entry.text, author_id: expert.id })
    .select("id, entry_date, text, created_at")
    .single();
  if (error) throw error;
  log.push(data);
}

const snapshot = buildSnapshot({
  tracker: { client_name: HUGH_TRACKER.clientName, project_title: HUGH_TRACKER.projectTitle, package_name: HUGH_TRACKER.packageName },
  expert: { name: expert.full_name || HUGH_TRACKER.expertName, email: expert.email },
  items,
  files,
  log,
});
const { error: publishError } = await supabase
  .from("client_trackers")
  .update({ published_snapshot: snapshot, published_at: new Date().toISOString(), status: "live" })
  .eq("id", tracker.id);
if (publishError) throw publishError;

console.log(`Live: ${(process.env.SITE_URL || "https://hq360.space").replace(/\/$/, "")}/track/${slug}`);
console.log(`Overall progress: ${snapshot.overall}% (spec expects 25%). Files uploaded: ${files.length}.`);
