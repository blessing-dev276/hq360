import { z } from "zod";

// Shared by the expert editor, the client page and the server. No secrets here.

export const ITEM_STATUSES = ["next", "progress", "done"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const STATUS_LABEL: Record<ItemStatus, string> = {
  next: "Up next",
  progress: "In progress",
  done: "Complete",
};

export const blocksSchema = z
  .object({
    checklist: z
      .array(z.object({ text: z.string().trim().min(1).max(300), done: z.boolean() }))
      .max(50)
      .optional(),
    // The list tracker, e.g. ten Goodreads lists and the book's position on each.
    lists: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          link: z.string().trim().url().max(500).or(z.literal("")),
          position: z.string().trim().max(120),
        }),
      )
      .max(50)
      .optional(),
    button: z
      .object({ label: z.string().trim().min(1).max(60), url: z.string().trim().url().max(500) })
      .optional(),
    highlight: z
      .object({
        text: z.string().trim().min(1).max(300),
        imageFileId: z.string().uuid().optional(),
      })
      .optional(),
  })
  .strict();
export type ItemBlocks = z.infer<typeof blocksSchema>;

export type TrackerItemRow = {
  id: string;
  position: number;
  title: string;
  status: ItemStatus;
  progress: number;
  description: string;
  is_free_bonus: boolean;
  portfolio_ready?: boolean;
  blocks: ItemBlocks;
};
export type TrackerFileRow = {
  id: string;
  item_id: string;
  kind: "image" | "video" | "pdf" | "other";
  filename: string;
  size: number;
  position: number;
};
export type LogEntryRow = { id: string; entry_date: string; text: string; created_at: string };

/** Overall ring: the average of paid items only; free bonus items are excluded. */
export function overallProgress(items: Pick<TrackerItemRow, "progress" | "is_free_bonus">[]) {
  const paid = items.filter((item) => !item.is_free_bonus);
  if (!paid.length) return 0;
  return Math.round(paid.reduce((sum, item) => sum + item.progress, 0) / paid.length);
}

/** Complete always means 100%; Up next keeps whatever the expert set (usually 0). */
export function normaliseProgress(status: ItemStatus, progress: number) {
  if (status === "done") return 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export type ClientSnapshot = {
  clientName: string;
  projectTitle: string;
  packageName: string;
  lastUpdated: string;
  overall: number;
  expert: { name: string; email: string | null };
  items: {
    id: string;
    title: string;
    status: ItemStatus;
    progress: number;
    description: string;
    isFreeBonus: boolean;
    blocks: ItemBlocks;
    files: { id: string; kind: TrackerFileRow["kind"]; filename: string; size: number }[];
  }[];
  log: { date: string; text: string }[];
};

/** What the client is allowed to see. Built at publish time and stored, so
 *  later working edits (and AI drafts) never leak before the next publish.
 *  Deliberately leaves out: passcode, client email, portfolio flags, blurbs. */
export function buildSnapshot(input: {
  tracker: { client_name: string; project_title: string; package_name: string };
  expert: { name: string; email: string | null };
  items: TrackerItemRow[];
  files: TrackerFileRow[];
  log: LogEntryRow[];
  now?: Date;
}): ClientSnapshot {
  const items = [...input.items].sort((a, b) => a.position - b.position);
  const filesFor = (id: string) =>
    input.files
      .filter((file) => file.item_id === id)
      .sort((a, b) => a.position - b.position)
      .map(({ id, kind, filename, size }) => ({ id, kind, filename, size }));
  return {
    clientName: input.tracker.client_name,
    projectTitle: input.tracker.project_title,
    packageName: input.tracker.package_name,
    lastUpdated: (input.now ?? new Date()).toISOString(),
    overall: overallProgress(items),
    expert: input.expert,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      progress: normaliseProgress(item.status, item.progress),
      description: item.description,
      isFreeBonus: item.is_free_bonus,
      blocks: blocksSchema.catch({}).parse(item.blocks ?? {}),
      files: filesFor(item.id),
    })),
    log: [...input.log]
      .sort(
        (a, b) =>
          b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
      )
      .map((entry) => ({ date: entry.entry_date, text: entry.text })),
  };
}

/** Every file id the published page may hand out a signed link for. */
export function snapshotFileIds(snapshot: ClientSnapshot | null) {
  const ids = new Set<string>();
  for (const item of snapshot?.items ?? []) {
    for (const file of item.files) ids.add(file.id);
    if (item.blocks.highlight?.imageFileId) ids.add(item.blocks.highlight.imageFileId);
  }
  return ids;
}

export function fileKind(contentType: string, filename: string): TrackerFileRow["kind"] {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType === "application/pdf" || /\.pdf$/i.test(filename)) return "pdf";
  return "other";
}

export const TRACKER_FILE_MAX_BYTES = 200 * 1024 * 1024;
