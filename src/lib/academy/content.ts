import { z } from "zod";

// Academy content records: chapters, niche guides, daily lessons and diagrams.
// Trainers write light markdown; it is rendered as React elements (never raw
// HTML), so stored content cannot inject markup or scripts.

export const CONTENT_KINDS = ["chapter", "niche_guide", "daily_lesson", "diagram"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const NEW_BADGE_DAYS = 7;

export const NICHE_FIELDS = [
  ["pitch", "What to pitch"],
  ["where", "Where to find them"],
  ["contact", "How to find contact details"],
  ["countries", "Countries"],
  ["watch_outs", "Watch outs"],
  ["first_message", "First message"],
] as const;

export type ContentRecord = {
  id: string;
  kind: ContentKind;
  playbook: "author" | "business";
  slug: string;
  number: number | null;
  part: string;
  group_name: string;
  title: string;
  summary: string;
  body: string;
  fields: Record<string, string>;
  svg: string | null;
  sort_order: number;
  published: boolean;
  published_at: string | null;
  lesson_date: string | null;
  updated_at: string;
  updated_by: string;
};

export const contentInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(CONTENT_KINDS),
    playbook: z.enum(["author", "business"]),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
      .max(120),
    number: z.number().int().min(0).max(999).nullable(),
    part: z.string().trim().max(80),
    group_name: z.string().trim().max(80),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().max(600),
    body: z.string().max(60000),
    fields: z.record(z.string().max(4000)),
    svg: z.string().max(200000).nullable(),
    sort_order: z.number().int().min(-10000).max(10000),
    published: z.boolean(),
    lesson_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "diagram" && !value.svg) ctx.addIssue({ code: "custom", message: "A diagram needs SVG." });
    if (value.svg && !safeSvg(value.svg))
      ctx.addIssue({ code: "custom", message: "The SVG contains scripts, events or external links. Remove them." });
  });

/** Diagrams render via <img src="data:image/svg+xml">, which never runs script.
 *  This check also keeps the stored SVG clean for anyone who downloads it. */
export function safeSvg(svg: string) {
  const text = svg.trim();
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) return false;
  if (/<script|<foreignObject|<iframe|<object|<embed/i.test(text)) return false;
  if (/\son[a-z]+\s*=/i.test(text)) return false;
  if (/(?:href|src)\s*=\s*["']?\s*(?:javascript:|data:text|https?:)/i.test(text)) return false;
  return true;
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;

export function isNew(publishedAt: string | null, now = new Date()) {
  if (!publishedAt) return false;
  const age = now.getTime() - new Date(publishedAt).getTime();
  return age >= 0 && age < NEW_BADGE_DAYS * 86400_000;
}

/** Today's lesson strip: the newest published lesson, chapter or guide from the last 7 days. */
export function todaysLesson(records: ContentRecord[], now = new Date()) {
  return (
    records
      .filter((r) => r.published && isNew(r.published_at, now))
      .sort((a, b) => {
        // Daily lessons win the strip; then the most recently published.
        const rank = (r: ContentRecord) => (r.kind === "daily_lesson" ? 0 : 1);
        return rank(a) - rank(b) || (b.published_at ?? "").localeCompare(a.published_at ?? "");
      })[0] ?? null
  );
}

export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "copy"; text: string }
  | { type: "quote"; text: string }
  | { type: "note"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "diagram"; slug: string };

/** Light markdown: ### headings, - and 1. lists, > quotes, "> copy:" Copy
 *  blocks, "> note:" callouts, | tables |, [[diagram:slug]] and _italic_ lines. */
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) {
      i += 1;
      continue;
    }
    const diagram = line.match(/^\[\[diagram:([a-z0-9-]+)\]\]$/);
    if (diagram) {
      blocks.push({ type: "diagram", slug: diagram[1]! });
      i += 1;
    } else if (/^#{2,4}\s/.test(line)) {
      blocks.push({ type: "heading", text: line.replace(/^#+\s*/, "") });
      i += 1;
    } else if (/^>\s*copy:/i.test(line)) {
      blocks.push({ type: "copy", text: line.replace(/^>\s*copy:\s*/i, "") });
      i += 1;
    } else if (/^>\s*note:/i.test(line)) {
      blocks.push({ type: "note", text: line.replace(/^>\s*note:\s*/i, "") });
      i += 1;
    } else if (line.startsWith(">")) {
      blocks.push({ type: "quote", text: line.replace(/^>\s*/, "") });
      i += 1;
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        const cells = lines[i]!.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      blocks.push({ type: "table", header: rows[0] ?? [], rows: rows.slice(1) });
    } else if (/^(-|\*|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(-|\*|\d+\.)\s/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^(-|\*|\d+\.)\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
    } else {
      // Always consume the first line, so an odd line (e.g. "[[typo") cannot stall the loop.
      const paragraph: string[] = [line];
      i += 1;
      while (i < lines.length && lines[i]!.trim() && !/^(#{2,4}\s|>|\||-\s|\*\s|\d+\.\s|\[\[)/.test(lines[i]!.trim())) {
        paragraph.push(lines[i]!.trim());
        i += 1;
      }
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    }
  }
  return blocks;
}

/** Inline **bold** and _italic_ as segments (rendered as <b>/<i>, never HTML). */
export function inlineSegments(text: string) {
  const out: { text: string; bold?: boolean; italic?: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*|_([^_]+)_/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(m[1] ? { text: m[1], bold: true } : { text: m[2]!, italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Policy: HQ360 does not target African countries. Flags any mention so a
 *  trainer cannot publish one by accident. */
const AFRICA = [
  "africa", "african", "nigeria", "ghana", "kenya", "south africa", "egypt", "morocco", "ethiopia",
  "uganda", "tanzania", "rwanda", "cameroon", "senegal", "zimbabwe", "zambia", "botswana", "namibia",
  "algeria", "tunisia", "angola", "ivory coast", "côte d'ivoire", "malawi", "mozambique", "sudan",
];
export function targetingPolicyIssues(record: Pick<ContentRecord, "title" | "summary" | "body" | "fields">) {
  const text = [record.title, record.summary, record.body, ...Object.values(record.fields ?? {})]
    .join("\n")
    .toLowerCase();
  return AFRICA.filter((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}
