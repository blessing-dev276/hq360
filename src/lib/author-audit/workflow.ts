import { z } from "zod";
export const SECTION_KEYS = [
  "executive_summary",
  "book_identity",
  "author_profile",
  "what_the_author_already_has",
  "amazon_audit",
  "goodreads_audit",
  "goodreads_listopia_audit",
  "website_audit",
  "search_visibility",
  "retailer_distribution",
  "reader_journey_audit",
  "series_and_backlist",
  "email_newsletter_audit",
  "social_media_audit",
  "media_and_authority",
  "reader_and_community_opportunities",
  "competitive_landscape",
  "priority_action_plan",
  "hq360_opportunities",
  "services_not_to_pitch",
  "evidence_library",
  "screenshot_queue",
  "manual_review_queue",
  "custom_sections",
  "client_site",
] as const;
export const CLASSIFICATIONS = [
  "verified_fact",
  "direct_observation",
  "supported_inference",
  "possible_opportunity",
  "unknown",
] as const;
export const WORKFLOW_STATUSES = [
  "research_pending",
  "research_ready",
  "research_imported",
  "under_review",
  "needs_manual_work",
  "approved",
  "site_generated",
  "qa_review",
  "published",
  "archived",
] as const;
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const text = z
  .string()
  .trim()
  .max(12000)
  .regex(/^(?![\s\S]*<\/?[a-z][^>]*>)[\s\S]*$/i, "Use plain text, not HTML or scripts");
export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => {
    try {
      const u = new URL(value);
      return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use a public http:// or https:// URL");
export const findingInput = z
  .object({
    title: text.min(1).max(300),
    category: text
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/, "Use a section key such as website_audit"),
    classification: z.enum(CLASSIFICATIONS).default("unknown"),
    what_we_checked: text.default(""),
    what_we_found: text.min(1),
    evidence: text.default(""),
    source_urls: z.array(safeUrl).max(30).default([]),
    interpretation: text.default(""),
    why_it_matters: text.default(""),
    recommendation: text.default(""),
    implementation_steps: z.array(text).max(30).default([]),
    priority: z
      .enum(["immediate", "high_impact", "medium_priority", "long_term", "optional"])
      .default("medium_priority"),
    impact_score: z.number().int().min(0).max(10).nullable().default(null),
    effort_score: z.number().int().min(0).max(10).nullable().default(null),
    confidence_score: z.number().int().min(0).max(100).nullable().default(null),
    service_match: text.max(200).default(""),
  })
  .strict();
export const listopiaInput = z
  .object({
    list_name: text.min(1).max(300),
    // Empty when the research couldn't find the list's URL.
    list_url: safeUrl.or(z.literal("")).default(""),
    book_present: z.boolean().nullable().default(null),
    position: z.number().int().positive().nullable().default(null),
    page: z.number().int().positive().nullable().default(null),
    votes: z.number().int().nonnegative().nullable().default(null),
    number_of_books: z.number().int().nonnegative().nullable().default(null),
    competition: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
    relevance_score: z.number().int().min(0).max(100).nullable().default(null),
    books_above: z.array(text).max(10).default([]),
    books_below: z.array(text).max(10).default([]),
    why_position: text.default(""),
    how_to_improve: text.default(""),
    evidence: text.default(""),
  })
  .strict();
export const taskInput = z
  .object({
    title: text.min(1).max(300),
    category: text.max(100).default("general"),
    instructions: text.default(""),
    required: z.boolean().default(true),
  })
  .strict();
export const actionInput = z
  .object({
    title: text.min(1).max(300),
    description: text.default(""),
    horizon: z.enum(["do_first", "next_30_days", "next_90_days", "long_term"]).default("do_first"),
    service: text.max(200).default(""),
  })
  .strict();
const narrative = z.union([text, z.array(z.unknown()), z.record(z.unknown()), z.null()]);
export const researchSchema = z
  .object({
    audit_meta: z
      .object({
        audit_id: z.string().uuid(),
        author_name: text.min(1),
        book_title: text.min(1),
        research_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
    audit_findings: z.array(findingInput).max(200),
    ...Object.fromEntries(SECTION_KEYS.map((key) => [key, narrative])),
  })
  .extend({
    goodreads_listopia_audit: z.array(listopiaInput).max(100),
    screenshot_queue: z.array(taskInput).max(100),
    manual_review_queue: z.array(taskInput).max(100),
    priority_action_plan: z.array(actionInput).max(100),
  })
  .strict();
export type FindingInput = z.infer<typeof findingInput>;
export type Finding = FindingInput & {
  id: string;
  section: string;
  observation: string;
  evidence_text: string;
  capability_slug: string | null;
  review_status: string;
  client_visible: boolean;
  manual_status: string;
  reviewer_notes: string;
  featured: boolean;
  hidden: boolean;
  origin: string;
};
export type Section = {
  id: string;
  key: string;
  title: string;
  content: string;
  enabled: boolean;
  sort_order: number;
  review_status: string;
};
export type Listopia = z.infer<typeof listopiaInput> & {
  id: string;
  manual_status: string;
  review_status: string;
  reviewer_notes: string;
};
export type Task = z.infer<typeof taskInput> & {
  id: string;
  kind: "screenshot" | "manual";
  status: string;
  notes: string;
};
export type Asset = {
  id: string;
  finding_id: string | null;
  listopia_id: string | null;
  task_id: string | null;
  original_filename: string;
  category: string;
  caption: string;
  proves: string;
  source: string;
  asset_date: string;
  review_status: string;
  display_kind: string;
  sort_order: number;
  storage_path?: string;
  storage_url?: string;
};
export type Action = z.infer<typeof actionInput> & {
  id: string;
  review_status: string;
  finding_ids: string[];
  sort_order: number;
};
export type WorkflowState = {
  audit: {
    id: string;
    workflow_version: number;
    status: string;
    review_status: string;
    publish_status: string;
    generated_prompt: string | null;
    research_source: string;
    input_snapshot: Record<string, string | null>;
    created_by: string | null;
    cta_enabled: boolean;
    authors: { name: string };
    books: { title: string };
  };
  findings: Finding[];
  sections: Section[];
  listopia: Listopia[];
  tasks: Task[];
  assets: Asset[];
  actions: Action[];
  imports: { id: string; created_at: string; source: string }[];
  sources: {
    id: string;
    url: string;
    provider: string;
    retrieved_at: string;
    raw_data: { query?: string; title?: string; excerpt?: string };
  }[];
  history: { id: string; actor: string; action: string; created_at: string }[];
  versions: {
    id: string;
    version_number: number;
    created_at: string;
    published_at: string | null;
    change_notes: string;
    qa_confirmed: boolean;
  }[];
  access: {
    public_slug: string;
    access_enabled: boolean;
    view_count: number;
    last_viewed_at: string | null;
    expires_at: string | null;
  } | null;
  permissions: { admin: boolean; review: boolean };
  assignments: { expert_id: string; role: string }[];
  experts: { id: string; full_name: string | null }[];
  template: string;
};
export function narrativeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(narrativeText).filter(Boolean).join("\n\n");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${label(k)}: ${narrativeText(v)}`)
      .join("\n\n");
  return "";
}
const normalized = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const PRIORITY_ALIASES: Record<string, string> = {
  critical: "immediate",
  urgent: "immediate",
  high: "high_impact",
  high_priority: "high_impact",
  medium: "medium_priority",
  normal: "medium_priority",
  low: "optional",
  low_priority: "optional",
  long: "long_term",
  long_term_priority: "long_term",
};
const HORIZON_ALIASES: Record<string, string> = {
  immediate: "do_first",
  now: "do_first",
  first: "do_first",
  "30_days": "next_30_days",
  next_30: "next_30_days",
  "90_days": "next_90_days",
  next_90: "next_90_days",
  longer_term: "long_term",
};
const slugValue = (v: unknown) =>
  typeof v === "string"
    ? v
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
    : v;
const isObj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Map common AI phrasings onto the import schema before strict validation,
 *  e.g. `priority: "high_priority"`, action items as {order, action, reason}
 *  and queue items as {item, reason}. Only renames known aliases; anything
 *  else still fails validation with a precise error. */
export function normalizeResearch(value: unknown): unknown {
  if (!isObj(value)) return value;
  const out: Record<string, unknown> = { ...value };
  if (Array.isArray(out.audit_findings))
    out.audit_findings = out.audit_findings.map((f) => {
      if (!isObj(f)) return f;
      const p = slugValue(f.priority);
      return typeof p === "string" ? { ...f, priority: PRIORITY_ALIASES[p] ?? p } : f;
    });
  if (Array.isArray(out.goodreads_listopia_audit))
    out.goodreads_listopia_audit = out.goodreads_listopia_audit.map((l) =>
      isObj(l) && l.list_url === null ? { ...l, list_url: "" } : l,
    );
  if (Array.isArray(out.priority_action_plan)) {
    const order = (a: unknown) => (isObj(a) && typeof a.order === "number" ? a.order : Infinity);
    out.priority_action_plan = [...out.priority_action_plan]
      .sort((a, b) => order(a) - order(b))
      .map((a) => {
        if (!isObj(a)) return a;
        const { order: _order, action, reason, timeframe, ...rest } = a;
        const horizon = slugValue(rest.horizon ?? timeframe);
        return {
          ...rest,
          title: rest.title ?? action,
          ...(rest.description === undefined && reason !== undefined
            ? { description: reason }
            : {}),
          ...(typeof horizon === "string" ? { horizon: HORIZON_ALIASES[horizon] ?? horizon } : {}),
        };
      });
  }
  for (const key of ["manual_review_queue", "screenshot_queue"] as const)
    if (Array.isArray(out[key]))
      out[key] = (out[key] as unknown[]).map((t) => {
        if (!isObj(t)) return t;
        const { item, reason, capture, ...rest } = t;
        return {
          ...rest,
          title: rest.title ?? item ?? capture,
          ...(rest.instructions === undefined && reason !== undefined
            ? { instructions: reason }
            : {}),
        };
      });
  return out;
}

export function validateResearch(
  raw: string,
  expected: { id: string; author: string; book: string },
  existing: Finding[] = [],
) {
  const errors: string[] = [];
  let value: unknown;
  try {
    value = normalizeResearch(JSON.parse(raw));
  } catch (e) {
    return { valid: false as const, errors: [`JSON syntax: ${(e as Error).message}`] };
  }
  function inspect(v: unknown, path: string) {
    if (typeof v === "string") {
      if (/<\/?[a-z][^>]*>/i.test(v)) errors.push(`${path}: HTML/scripts are not allowed`);
      if (/(?:url|link)$/i.test(path) && v && !safeUrl.safeParse(v).success)
        errors.push(`${path}: invalid URL`);
    } else if (Array.isArray(v)) v.forEach((x, i) => inspect(x, `${path}[${i}]`));
    else if (v && typeof v === "object")
      Object.entries(v).forEach(([k, x]) => inspect(x, `${path}.${k}`));
  }
  inspect(value, "research");
  const parsed = researchSchema.safeParse(value);
  if (!parsed.success)
    return {
      valid: false as const,
      errors: [
        ...errors,
        ...parsed.error.issues.map((i) => `${i.path.join(".") || "research"}: ${i.message}`),
      ],
    };
  const data = parsed.data;
  for (const key of SECTION_KEYS)
    if (!(key in (value as Record<string, unknown>)))
      errors.push(`${key}: required section is missing; use null or [] when unavailable`);
  if (data.audit_meta.audit_id !== expected.id)
    errors.push("audit_meta.audit_id: does not match this audit");
  if (normalized(data.audit_meta.author_name) !== normalized(expected.author))
    errors.push("audit_meta.author_name: does not match this author");
  if (normalized(data.audit_meta.book_title) !== normalized(expected.book))
    errors.push("audit_meta.book_title: does not match this book");
  const seen = new Set(existing.map((f) => normalized(`${f.category}|${f.title}`)));
  data.audit_findings.forEach((f, i) => {
    const key = normalized(`${f.category}|${f.title}`);
    if (seen.has(key)) errors.push(`audit_findings.${i}: duplicate category/title`);
    seen.add(key);
  });
  if (errors.length) return { valid: false as const, errors };
  const obj = data as unknown as Record<string, unknown>;
  const internal = new Set([
    "services_not_to_pitch",
    "evidence_library",
    "screenshot_queue",
    "manual_review_queue",
    "custom_sections",
    "client_site",
    "priority_action_plan",
    "goodreads_listopia_audit",
  ]);
  const sections = SECTION_KEYS.map((key, i) => ({
    key,
    title: label(key),
    content: internal.has(key) && key !== "services_not_to_pitch" ? "" : narrativeText(obj[key]),
    sort_order: i,
    enabled:
      !internal.has(key) || key === "goodreads_listopia_audit" || key === "priority_action_plan",
  }));
  for (const finding of data.audit_findings)
    if (!sections.some((s) => s.key === finding.category))
      sections.push({
        key: finding.category as (typeof SECTION_KEYS)[number],
        title: label(finding.category),
        content: "",
        sort_order: sections.length,
        enabled: true,
      });
  const custom = obj.custom_sections;
  if (Array.isArray(custom))
    for (const [i, v] of custom.entries()) {
      if (v && typeof v === "object") {
        const c = v as Record<string, unknown>;
        sections.push({
          key: `custom_${i}` as (typeof SECTION_KEYS)[number],
          title: String(c.title || `Custom section ${i + 1}`).slice(0, 200),
          content: narrativeText(c.content ?? c),
          sort_order: sections.length,
          enabled: true,
        });
      }
    }
  return {
    valid: true as const,
    errors: [],
    data: {
      researchDate: data.audit_meta.research_date,
      sections,
      findings: data.audit_findings,
      listopia: data.goodreads_listopia_audit,
      tasks: [
        ...data.screenshot_queue.map((t) => ({ ...t, kind: "screenshot" })),
        ...data.manual_review_queue.map((t) => ({ ...t, kind: "manual" })),
      ],
      actions: data.priority_action_plan,
    },
  };
}
export function reviewIssues(
  state: Pick<WorkflowState, "findings" | "sections" | "assets" | "tasks" | "actions" | "listopia">,
) {
  const errors: string[] = [];
  const enabled = new Set(state.sections.filter((s) => s.enabled).map((s) => s.key));
  const visible = state.findings.filter((f) => !f.hidden && enabled.has(f.category));
  if (!visible.some((f) => f.review_status === "approved"))
    errors.push("Approve at least one visible finding.");
  visible
    .filter((f) => !["approved", "rejected"].includes(f.review_status))
    .forEach((f) => errors.push(`Review finding: ${f.title}`));
  visible
    .filter(
      (f) =>
        f.review_status === "approved" &&
        (!["verified", "not_applicable"].includes(f.manual_status) ||
          !f.recommendation ||
          (!f.source_urls.length && !f.evidence_text)),
    )
    .forEach((f) =>
      errors.push(`Complete evidence, recommendation and manual verification: ${f.title}`),
    );
  state.sections
    .filter(
      (s) =>
        s.enabled &&
        (s.content ||
          visible.some((f) => f.category === s.key) ||
          (s.key === "goodreads_listopia_audit" &&
            state.listopia.some((l) => l.review_status !== "rejected")) ||
          (s.key === "priority_action_plan" &&
            state.actions.some((a) => a.review_status !== "rejected"))) &&
        s.review_status !== "approved",
    )
    .forEach((s) => errors.push(`Approve section: ${s.title}`));
  state.tasks
    .filter((t) => t.required && !["approved", "not_applicable"].includes(t.status))
    .forEach((t) => errors.push(`Complete ${t.kind}: ${t.title}`));
  state.assets
    .filter((a) => a.review_status === "pending")
    .forEach((a) => errors.push(`Review screenshot: ${a.original_filename}`));
  state.actions
    .filter((a) => !["approved", "rejected"].includes(a.review_status))
    .forEach((a) => errors.push(`Review action: ${a.title}`));
  state.listopia
    .filter(
      (l) =>
        l.review_status !== "rejected" &&
        (l.review_status !== "approved" ||
          !["verified", "not_applicable"].includes(l.manual_status)),
    )
    .forEach((l) => errors.push(`Verify Listopia list: ${l.list_name}`));
  state.tasks
    .filter(
      (t) =>
        t.required &&
        t.kind === "screenshot" &&
        t.status === "approved" &&
        !state.assets.some((a) => a.task_id === t.id && a.review_status === "approved"),
    )
    .forEach((t) => errors.push(`Approve an uploaded screenshot for: ${t.title}`));
  state.assets
    .filter(
      (a) =>
        a.review_status === "approved" && (!a.caption || !a.proves || !a.source || !a.asset_date),
    )
    .forEach((a) =>
      errors.push(
        `Complete screenshot caption, proof, source and capture date: ${a.original_filename}`,
      ),
    );
  state.actions
    .filter(
      (a) =>
        a.review_status === "approved" &&
        a.finding_ids.some(
          (id) => !visible.some((f) => f.id === id && f.review_status === "approved"),
        ),
    )
    .forEach((a) => errors.push(`Action references unapproved or hidden findings: ${a.title}`));
  return errors;
}
export const DEFAULT_PROMPT = `You are researching an evidence-led HQ360 book visibility consultancy audit. Return valid JSON only: no Markdown fences, HTML, scripts or invented evidence. Research public sources deeply. Distinguish verified_fact, direct_observation, supported_inference, possible_opportunity and unknown. Never treat lack of search results as proof of absence. Do not assume Listopia ranking algorithms or an author's interest in services. Cite exact source URLs and retrieval dates in evidence. Never invent screenshots. Findings are validated automatically with no human verification step, so leave screenshot_queue and manual_review_queue empty and include only findings your sources support, each with a recommendation. Unknown metrics must be null. Include strengths and services_not_to_pitch. Recommend only relevant services supported by evidence. Research every area: Amazon, Goodreads and Listopia, the author's website, newsletter, social media, press, interviews, retailers and other titles.\n\nAudit: {{audit_id}}\nAuthor: {{author_name}}\nBook: {{book_title}}\nDate: {{date}}\nURLs and notes: {{context}}\n\nUse this exact JSON shape (all keys are required; narrative sections may be null or plain-text objects, queues may be empty). Each finding requires a title, category, what_we_found; use the demonstrated remaining fields. No review/approval/publication flags. Use exactly these values -- priority: immediate, high_impact, medium_priority, long_term or optional; classification: verified_fact, direct_observation, supported_inference, possible_opportunity or unknown; horizon: do_first, next_30_days, next_90_days or long_term; competition: low, medium, high or unknown. Use the field names shown and no others; use "" for an unknown list_url.\n{{schema}}`;
export function promptFor(template: string, state: WorkflowState["audit"]) {
  const sample: Record<string, unknown> = {
    audit_meta: {
      audit_id: state.id,
      author_name: state.authors.name,
      book_title: state.books.title,
      research_date: new Date().toISOString().slice(0, 10),
    },
    ...Object.fromEntries(SECTION_KEYS.map((k) => [k, null])),
    audit_findings: [
      {
        title: "Specific observation",
        category: "website_audit",
        classification: "supported_inference",
        what_we_checked: "",
        what_we_found: "",
        evidence: "Exact supporting evidence and retrieval date",
        source_urls: ["https://example.com"],
        interpretation: "",
        why_it_matters: "",
        recommendation: "",
        implementation_steps: [],
        priority: "medium_priority",
        impact_score: null,
        effort_score: null,
        confidence_score: null,
        service_match: "",
      },
    ],
    goodreads_listopia_audit: [
      {
        list_name: "",
        list_url: "https://www.goodreads.com/list/show/example",
        book_present: null,
        position: null,
        page: null,
        votes: null,
        number_of_books: null,
        competition: "unknown",
        relevance_score: null,
        books_above: [],
        books_below: [],
        why_position: "Interpretation only, not an algorithm claim",
        how_to_improve: "",
        evidence: "",
      },
    ],
    priority_action_plan: [
      {
        title: "Specific action to take",
        description: "Why, tied to the findings above",
        horizon: "do_first",
        service: "",
      },
    ],
    screenshot_queue: [],
    manual_review_queue: [],
    custom_sections: [],
    client_site: {},
  };
  const values: Record<string, string> = {
    audit_id: state.id,
    author_name: state.authors.name,
    book_title: state.books.title,
    date: new Date().toISOString().slice(0, 10),
    context: JSON.stringify(state.input_snapshot),
    schema: JSON.stringify(sample, null, 2),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}
