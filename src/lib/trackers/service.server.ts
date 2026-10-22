import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSnapshot,
  normaliseProgress,
  overallProgress,
  type ClientSnapshot,
  type ItemBlocks,
  type ItemStatus,
  type LogEntryRow,
  type TrackerFileRow,
  type TrackerItemRow,
} from "./core";
import { generatePasscode, hashPasscode, trackerSlug } from "./security.server";

// Database work for client trackers. Every expert query is scoped by
// expert_id, so one expert can never read or change another expert's tracker.
// Admin may act on every tracker.

// The generated Database type does not include the tracker tables yet.
export const db = () => supabaseAdmin as unknown as SupabaseClient;

export type Actor = { role: "admin" } | { role: "expert"; expertId: string };
export const expertActor = (expertId: string): Actor => ({ role: "expert", expertId });
/** Row filter: experts see only their own rows; admin sees all. */
export const own = (actor: Actor): Record<string, string> =>
  actor.role === "expert" ? { expert_id: actor.expertId } : {};
/** Expert id to record as author; admin actions have none. */
export const authorOf = (actor: Actor) => (actor.role === "expert" ? actor.expertId : null);
/** Templates: each expert has their own; admin's have no expert. */
function templateScope<Q>(query: Q, actor: Actor): Q {
  const q = query as unknown as { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q };
  return actor.role === "expert" ? q.eq("expert_id", actor.expertId) : q.is("expert_id", null);
}
export const BUCKET = "tracker-files";

export class TrackerError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// passcode_hash is never selected for the dashboard; hasPasscode is derived.
const TRACKER_FIELDS =
  "id, expert_id, client_name, client_email, project_title, package_name, slug, status, portfolio_consent, consent_at, consent_method, consent_allows_naming, published_at, created_at, updated_at";
const ITEM_FIELDS =
  "id, tracker_id, position, title, status, progress, description, is_free_bonus, portfolio_ready, portfolio_blurb, blocks";

export type TrackerRow = {
  id: string;
  expert_id: string;
  client_name: string;
  client_email: string | null;
  project_title: string;
  package_name: string;
  slug: string;
  status: "draft" | "live" | "archived";
  portfolio_consent: boolean;
  consent_at: string | null;
  consent_method: string | null;
  consent_allows_naming: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function siteUrl() {
  return (process.env.SITE_URL || "https://hq360.space").replace(/\/$/, "");
}
export const trackerUrl = (slug: string) => `${siteUrl()}/track/${slug}`;

export async function ownedTracker(actor: Actor, id: string): Promise<TrackerRow> {
  const { data, error } = await db()
    .from("client_trackers")
    .select(TRACKER_FIELDS)
    .eq("id", id)
    .match(own(actor))
    .maybeSingle();
  if (error) throw new TrackerError("Could not load this tracker.", 503);
  if (!data) throw new TrackerError("Tracker not found.", 404);
  return data as TrackerRow;
}

async function touch(id: string) {
  await db().from("client_trackers").update({ updated_at: new Date().toISOString() }).eq("id", id);
}

const weekAgo = () => new Date(Date.now() - 7 * 86400_000).toISOString();

/** Trackers list: client, project, progress, last update, views this week, link. */
export async function listTrackers(actor: Actor) {
  const { data: trackers, error } = await db()
    .from("client_trackers")
    // Admin sees every expert's trackers, so the owner's name comes along.
    .select(`${TRACKER_FIELDS}, expert:expert_profiles(full_name, email)`)
    .match(own(actor))
    .order("updated_at", { ascending: false });
  if (error) throw new TrackerError("Could not load your trackers.", 503);
  const ids = (trackers ?? []).map((t) => t.id as string);
  if (!ids.length) return [];
  const [items, events] = await Promise.all([
    db().from("tracker_items").select("tracker_id, progress, is_free_bonus").in("tracker_id", ids),
    db()
      .from("tracker_view_events")
      .select("tracker_id, event, created_at")
      .in("tracker_id", ids)
      .in("event", ["open", "unlock"])
      .gte("created_at", new Date(Date.now() - 90 * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  const since = weekAgo();
  return (trackers as TrackerRow[]).map((tracker) => {
    const seen = (events.data ?? []).filter((e) => e.tracker_id === tracker.id);
    return {
      ...tracker,
      url: trackerUrl(tracker.slug),
      progress: overallProgress(
        (items.data ?? []).filter((i) => i.tracker_id === tracker.id) as TrackerItemRow[],
      ),
      viewsThisWeek: seen.filter((e) => e.event === "open" && e.created_at >= since).length,
      lastViewedAt: seen.find((e) => e.event === "unlock")?.created_at ?? null,
    };
  });
}

export type TemplateItem = {
  title: string;
  description: string;
  is_free_bonus: boolean;
  blocks: ItemBlocks;
};

export async function createTracker(
  actor: Actor,
  input: {
    clientName: string;
    clientEmail: string;
    projectTitle: string;
    packageName: string;
    passcode?: string;
    slugSuffix?: string;
    templateId?: string;
    /** Admin only: the expert who will own the tracker. */
    expertId?: string;
  },
) {
  const ownerId = actor.role === "expert" ? actor.expertId : input.expertId;
  if (!ownerId) throw new TrackerError("Choose the expert this tracker belongs to.", 400);
  let items: TemplateItem[] = [];
  if (input.templateId) {
    const { data } = await templateScope(
      db().from("tracker_templates").select("items, package_name").eq("id", input.templateId),
      actor,
    ).maybeSingle();
    if (!data) throw new TrackerError("Template not found.", 404);
    items = (data.items ?? []) as TemplateItem[];
    if (!input.packageName) input.packageName = (data.package_name as string) ?? "";
  }
  const passcode = input.passcode?.trim() || generatePasscode();
  const passcode_hash = await hashPasscode(passcode);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = trackerSlug(input.clientName, attempt === 0 ? input.slugSuffix : undefined);
    const { data, error } = await db()
      .from("client_trackers")
      .insert({
        expert_id: ownerId,
        client_name: input.clientName,
        client_email: input.clientEmail || null,
        project_title: input.projectTitle,
        package_name: input.packageName,
        slug,
        passcode_hash,
      })
      .select(TRACKER_FIELDS)
      .maybeSingle();
    if (error?.code === "23505") continue; // slug taken: draw new random characters
    if (error || !data) throw new TrackerError("Could not create the tracker.", 503);
    await storePasscode(data.id as string, passcode);
    if (items.length) {
      await db()
        .from("tracker_items")
        .insert(
          items.map((item, position) => ({
            tracker_id: data.id,
            position,
            title: item.title,
            description: item.description ?? "",
            is_free_bonus: Boolean(item.is_free_bonus),
            blocks: item.blocks ?? {},
          })),
        );
    }
    return { tracker: data as TrackerRow, passcode, url: trackerUrl(slug) };
  }
  throw new TrackerError("Could not find a free link. Please try again.", 503);
}

export async function trackerDetail(actor: Actor, id: string) {
  const tracker = await ownedTracker(actor, id);
  const [items, files, log, drafts, hashRow] = await Promise.all([
    db().from("tracker_items").select(ITEM_FIELDS).eq("tracker_id", id).order("position"),
    db()
      .from("tracker_files")
      .select("id, item_id, kind, filename, size, position, content_type")
      .eq("tracker_id", id)
      .order("position"),
    db()
      .from("tracker_log_entries")
      .select("id, entry_date, text, source, created_at")
      .eq("tracker_id", id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    db()
      .from("tracker_ai_drafts")
      .select("id, item_id, action, input, output, status, created_at")
      .eq("tracker_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    db().from("client_trackers").select("passcode_hash, passcode_encrypted").eq("id", id).maybeSingle(),
  ]);
  const stored = hashRow.data?.passcode_encrypted as string | null | undefined;
  if (items.error || files.error || log.error)
    throw new TrackerError("Could not load this tracker.", 503);
  return {
    tracker: { ...tracker, url: trackerUrl(tracker.slug), hasPasscode: Boolean(hashRow.data?.passcode_hash),
      passcode: stored ? await readPasscode(id, stored) : null,
    },
    items: items.data ?? [],
    files: files.data ?? [],
    log: log.data ?? [],
    // The drafts table arrives with phase 2; before that the list is empty.
    drafts: drafts.error ? [] : (drafts.data ?? []),
    views: await viewStats(id),
  };
}

export async function updateTracker(
  actor: Actor,
  id: string,
  patch: Partial<Pick<TrackerRow, "client_name" | "client_email" | "project_title" | "package_name" | "status">>,
) {
  await ownedTracker(actor, id);
  if (patch.status === "live")
    throw new TrackerError("Use Publish to make the page live.", 400);
  const { error } = await db()
    .from("client_trackers")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .match(own(actor));
  if (error) throw new TrackerError("Could not save the tracker.", 503);
}

export async function deleteTracker(actor: Actor, id: string) {
  await ownedTracker(actor, id);
  const { data: files } = await db().from("tracker_files").select("storage_key").eq("tracker_id", id);
  // Deleting the tracker cascades to items, and from items to portfolio entries.
  const { error } = await db().from("client_trackers").delete().eq("id", id).match(own(actor));
  if (error) throw new TrackerError("Could not delete the tracker.", 503);
  const keys = (files ?? []).map((f) => f.storage_key as string);
  if (keys.length) await db().storage.from(BUCKET).remove(keys);
}

export async function addItem(
  actor: Actor,
  trackerId: string,
  input: { title: string; description?: string; is_free_bonus?: boolean },
) {
  await ownedTracker(actor, trackerId);
  const { data: last } = await db()
    .from("tracker_items")
    .select("position")
    .eq("tracker_id", trackerId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db()
    .from("tracker_items")
    .insert({
      tracker_id: trackerId,
      position: ((last?.position as number | undefined) ?? -1) + 1,
      title: input.title,
      description: input.description ?? "",
      is_free_bonus: Boolean(input.is_free_bonus),
    })
    .select(ITEM_FIELDS)
    .maybeSingle();
  if (error || !data) throw new TrackerError("Could not add the item.", 503);
  await touch(trackerId);
  return data;
}

export type ItemPatch = Partial<{
  title: string;
  status: ItemStatus;
  progress: number;
  description: string;
  is_free_bonus: boolean;
  portfolio_ready: boolean;
  portfolio_blurb: string;
  blocks: ItemBlocks;
}>;

export async function updateItem(
  actor: Actor,
  trackerId: string,
  itemId: string,
  patch: ItemPatch,
) {
  await ownedTracker(actor, trackerId);
  const { data: current } = await db()
    .from("tracker_items")
    .select(ITEM_FIELDS)
    .eq("id", itemId)
    .eq("tracker_id", trackerId)
    .maybeSingle();
  if (!current) throw new TrackerError("Item not found.", 404);
  const status = (patch.status ?? current.status) as ItemStatus;
  const next: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status !== undefined || patch.progress !== undefined)
    next.progress = normaliseProgress(status, patch.progress ?? (current.progress as number));
  // Only a person marks portfolio readiness, and only on finished work.
  if (patch.portfolio_ready && status !== "done")
    throw new TrackerError("Mark the item Complete before making it portfolio ready.", 400);
  const { data, error } = await db()
    .from("tracker_items")
    .update(next)
    .eq("id", itemId)
    .eq("tracker_id", trackerId)
    .select(ITEM_FIELDS)
    .maybeSingle();
  if (error || !data) throw new TrackerError("Could not save the item.", 503);
  // Completing an item writes the log line for the client automatically.
  if (status === "done" && current.status !== "done") {
    await db()
      .from("tracker_log_entries")
      .insert({ tracker_id: trackerId, text: completionLogText(data.title as string), author_id: authorOf(actor) });
  }
  await touch(trackerId);
  return data;
}

export function completionLogText(title: string) {
  const clean = title.trim().replace(/[.!]+$/, "");
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)} completed.`;
}

export async function deleteItem(actor: Actor, trackerId: string, itemId: string) {
  await ownedTracker(actor, trackerId);
  const { data: files } = await db().from("tracker_files").select("storage_key").eq("item_id", itemId);
  const { error } = await db().from("tracker_items").delete().eq("id", itemId).eq("tracker_id", trackerId);
  if (error) throw new TrackerError("Could not delete the item.", 503);
  const keys = (files ?? []).map((f) => f.storage_key as string);
  if (keys.length) await db().storage.from(BUCKET).remove(keys);
  await touch(trackerId);
}

export async function reorderItems(actor: Actor, trackerId: string, ids: string[]) {
  await ownedTracker(actor, trackerId);
  const results = await Promise.all(
    ids.map((id, position) =>
      db().from("tracker_items").update({ position }).eq("id", id).eq("tracker_id", trackerId),
    ),
  );
  if (results.some((r) => r.error)) throw new TrackerError("Could not reorder the items.", 503);
  await touch(trackerId);
}

export async function addLogEntry(
  actor: Actor,
  trackerId: string,
  input: { text: string; date?: string; source?: "manual" | "ai" },
) {
  await ownedTracker(actor, trackerId);
  const { data, error } = await db()
    .from("tracker_log_entries")
    .insert({
      tracker_id: trackerId,
      text: input.text,
      entry_date: input.date || new Date().toISOString().slice(0, 10),
      source: input.source ?? "manual",
      author_id: authorOf(actor),
    })
    .select("id, entry_date, text, source, created_at")
    .maybeSingle();
  if (error || !data) throw new TrackerError("Could not add the update.", 503);
  await touch(trackerId);
  return data;
}

export async function deleteLogEntry(actor: Actor, trackerId: string, entryId: string) {
  await ownedTracker(actor, trackerId);
  const { error } = await db()
    .from("tracker_log_entries")
    .delete()
    .eq("id", entryId)
    .eq("tracker_id", trackerId);
  if (error) throw new TrackerError("Could not delete the update.", 503);
}

/** Encrypted copy so the owner can see the passcode until it is replaced. */
async function storePasscode(trackerId: string, passcode: string) {
  const { encryptAiKey } = await import("./ai-keys.server");
  await db()
    .from("client_trackers")
    .update({ passcode_encrypted: encryptAiKey(`tracker:${trackerId}`, passcode) })
    .eq("id", trackerId);
}
async function readPasscode(trackerId: string, stored: string) {
  const { decryptAiKey } = await import("./ai-keys.server");
  try {
    return decryptAiKey(`tracker:${trackerId}`, stored);
  } catch {
    return null;
  }
}

/** Set a chosen passcode (e.g. keep an existing one) or generate WORD-1234. */
export async function resetPasscode(actor: Actor, trackerId: string, chosen?: string) {
  await ownedTracker(actor, trackerId);
  const passcode = chosen?.trim() || generatePasscode();
  const passcode_hash = await hashPasscode(passcode);
  const { data: row } = await db()
    .from("client_trackers")
    .select("passcode_version")
    .eq("id", trackerId)
    .maybeSingle();
  const { error } = await db()
    .from("client_trackers")
    .update({
      passcode_hash,
      passcode_version: ((row?.passcode_version as number | undefined) ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trackerId)
    .match(own(actor));
  if (error) throw new TrackerError("Could not reset the passcode.", 503);
  await storePasscode(trackerId, passcode);
  return passcode;
}

/** The tracker's owner is the contact on the client page, even when admin publishes. */
async function expertContact(expertId: string) {
  const { data } = await db()
    .from("expert_profiles")
    .select("full_name, email")
    .eq("id", expertId)
    .maybeSingle();
  return { name: (data?.full_name as string | null) || "Your HQ360 expert", email: (data?.email as string | null) ?? null };
}

/** The snapshot as it would look if published now (Preview as client). */
export async function workingSnapshot(actor: Actor, trackerId: string): Promise<ClientSnapshot> {
  const tracker = await ownedTracker(actor, trackerId);
  const [items, files, log, expert] = await Promise.all([
    db().from("tracker_items").select(ITEM_FIELDS).eq("tracker_id", trackerId),
    db().from("tracker_files").select("id, item_id, kind, filename, size, position").eq("tracker_id", trackerId),
    db().from("tracker_log_entries").select("id, entry_date, text, created_at").eq("tracker_id", trackerId),
    expertContact(tracker.expert_id),
  ]);
  if (items.error || files.error || log.error) throw new TrackerError("Could not build the page.", 503);
  return buildSnapshot({
    tracker,
    expert,
    items: (items.data ?? []) as TrackerItemRow[],
    files: (files.data ?? []) as TrackerFileRow[],
    log: (log.data ?? []) as LogEntryRow[],
  });
}

/** Publishing is the only way content reaches the client page. */
export async function publishTracker(actor: Actor, trackerId: string, notify: boolean) {
  const tracker = await ownedTracker(actor, trackerId);
  const { data: pending } = await db()
    .from("tracker_ai_drafts")
    .select("id")
    .eq("tracker_id", trackerId)
    .eq("status", "pending")
    .limit(1);
  const snapshot = await workingSnapshot(actor, trackerId);
  const publishedAt = new Date().toISOString();
  const { error } = await db()
    .from("client_trackers")
    .update({ published_snapshot: snapshot, published_at: publishedAt, status: "live", updated_at: publishedAt })
    .eq("id", trackerId)
    .match(own(actor));
  if (error)
    throw new TrackerError(
      error.code === "23514" ? "Set a passcode before publishing." : "Could not publish.",
      error.code === "23514" ? 400 : 503,
    );
  let notified = false;
  if (notify && tracker.client_email) {
    const { sendEmail } = await import("@/lib/email.server");
    const result = await sendEmail({
      to: tracker.client_email,
      subject: `New update on your ${tracker.project_title || "project"} progress page`,
      // The link only. The passcode is never sent by the system.
      text: `Hello ${tracker.client_name},\n\nThere is a new update on your private progress page:\n\n${trackerUrl(tracker.slug)}\n\nUse the passcode we gave you to open it.\n\n${snapshot.expert.name}, HQ360`,
    });
    notified = result.sent;
  }
  return { publishedAt, notified, pendingAiDrafts: Boolean(pending?.length) };
}

export async function createFileUpload(
  actor: Actor,
  trackerId: string,
  input: { itemId: string; filename: string; contentType: string; size: number; kind: TrackerFileRow["kind"] },
) {
  const tracker = await ownedTracker(actor, trackerId);
  const { data: item } = await db()
    .from("tracker_items")
    .select("id")
    .eq("id", input.itemId)
    .eq("tracker_id", trackerId)
    .maybeSingle();
  if (!item) throw new TrackerError("Item not found.", 404);
  const safeName = input.filename.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const extension = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : "";
  const storage_key = `${tracker.expert_id}/${trackerId}/${crypto.randomUUID()}${extension.toLowerCase()}`;
  const { data: upload, error: uploadError } = await db()
    .storage.from(BUCKET)
    .createSignedUploadUrl(storage_key);
  if (uploadError || !upload) throw new TrackerError("File storage is unavailable.", 503);
  const { count } = await db()
    .from("tracker_files")
    .select("id", { count: "exact", head: true })
    .eq("item_id", input.itemId);
  const { data, error } = await db()
    .from("tracker_files")
    .insert({
      tracker_id: trackerId,
      item_id: input.itemId,
      kind: input.kind,
      storage_key,
      filename: safeName,
      size: input.size,
      content_type: input.contentType,
      position: count ?? 0,
    })
    .select("id, item_id, kind, filename, size, position, content_type")
    .maybeSingle();
  if (error || !data) throw new TrackerError("Could not save the file.", 503);
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return { file: data, uploadUrl: new URL(upload.signedUrl, base).href };
}

export async function deleteFile(actor: Actor, trackerId: string, fileId: string) {
  await ownedTracker(actor, trackerId);
  const { data } = await db()
    .from("tracker_files")
    .select("storage_key")
    .eq("id", fileId)
    .eq("tracker_id", trackerId)
    .maybeSingle();
  if (!data) throw new TrackerError("File not found.", 404);
  await db().from("tracker_files").delete().eq("id", fileId);
  await db().storage.from(BUCKET).remove([data.storage_key as string]);
}

/** A short lived link (10 minutes: long enough to start a video). */
export async function signedFileUrl(storageKey: string, filename: string, download: boolean) {
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(storageKey, 600, download ? { download: filename } : undefined);
  if (error || !data) throw new TrackerError("File is unavailable.", 503);
  return data.signedUrl;
}

/** Opens, unique visitors, unlocks, failed attempts, last viewed, and plays and downloads per item. */
export async function viewStats(trackerId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const { data } = await db()
    .from("tracker_view_events")
    .select("event, item_id, visitor_hash, created_at")
    .eq("tracker_id", trackerId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);
  return summariseViews((data ?? []) as ViewEvent[], new Date());
}

export type ViewEvent = { event: string; item_id: string | null; visitor_hash: string; created_at: string };

export function summariseViews(events: ViewEvent[], now: Date) {
  const weekStart = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const week = events.filter((e) => e.created_at >= weekStart);
  const byDay: { day: string; opens: number }[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 86400_000).toISOString().slice(0, 10);
    byDay.push({ day, opens: events.filter((e) => e.event === "open" && e.created_at.startsWith(day)).length });
  }
  const engagement: Record<string, { plays: number; downloads: number }> = {};
  for (const e of events) {
    if (!e.item_id || (e.event !== "play" && e.event !== "download")) continue;
    engagement[e.item_id] ??= { plays: 0, downloads: 0 };
    engagement[e.item_id]![e.event === "play" ? "plays" : "downloads"] += 1;
  }
  return {
    opensThisWeek: week.filter((e) => e.event === "open").length,
    uniqueVisitorsThisWeek: new Set(week.filter((e) => e.event === "open").map((e) => e.visitor_hash)).size,
    unlocksThisWeek: week.filter((e) => e.event === "unlock").length,
    failedThisWeek: week.filter((e) => e.event === "fail").length,
    lastViewedAt: events.find((e) => e.event === "unlock")?.created_at ?? null,
    byDay,
    engagement,
  };
}

export async function listTemplates(actor: Actor) {
  const { data, error } = await templateScope(
    db().from("tracker_templates").select("id, name, package_name, items, created_at"),
    actor,
  ).order("name");
  if (error) throw new TrackerError("Could not load templates.", 503);
  return data ?? [];
}

/** Save this tracker's items (not their progress or files) as a reusable package. */
export async function saveTemplate(actor: Actor, trackerId: string, name: string) {
  const tracker = await ownedTracker(actor, trackerId);
  const { data: items } = await db()
    .from("tracker_items")
    .select("title, description, is_free_bonus, blocks")
    .eq("tracker_id", trackerId)
    .order("position");
  const templateItems: TemplateItem[] = (items ?? []).map((item) => {
    const blocks = { ...(item.blocks as ItemBlocks) };
    delete blocks.highlight; // client specific results do not belong in a template
    if (blocks.lists) blocks.lists = blocks.lists.map((l) => ({ ...l, position: "" }));
    return {
      title: item.title as string,
      description: item.description as string,
      is_free_bonus: item.is_free_bonus as boolean,
      blocks,
    };
  });
  const { data, error } = await db()
    .from("tracker_templates")
    // Admin's templates have no expert.
    .insert({ expert_id: authorOf(actor), name, package_name: tracker.package_name, items: templateItems })
    .select("id, name, package_name, items, created_at")
    .maybeSingle();
  if (error || !data) throw new TrackerError("Could not save the template.", 503);
  return data;
}

export async function deleteTemplate(actor: Actor, templateId: string) {
  const { error } = await templateScope(
    db().from("tracker_templates").delete().eq("id", templateId),
    actor,
  );
  if (error) throw new TrackerError("Could not delete the template.", 503);
}
