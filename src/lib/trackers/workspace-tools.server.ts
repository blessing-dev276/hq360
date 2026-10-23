import { z } from "zod";
import { PROJECT_STATUSES, SALES_STAGES } from "@/lib/sales";
import { db, TrackerError, type Actor } from "./service.server";

// Workspace-wide tools for the AI Assistant, beyond client tracking: a read-only
// snapshot of leads, sales, audits and experts, plus a few safe writes (leads,
// draft proposals) and "open_page" so the assistant can take you somewhere.
// Every write is scoped exactly like the manual screens: experts touch only
// what they own, and Sales actions need the Sales tool.

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Pages the assistant may open. Ids match the workspace tabs. */
export const ADMIN_PAGES = [
  "overview",
  "scout",
  "outreach",
  "audits",
  "payments",
  "quotes",
  "proposals",
  "experts",
  "academy",
  "trackers",
  "visitors",
  "projects",
  "work",
  "settings",
] as const;
export const EXPERT_PAGES = [
  "dashboard",
  "profile",
  "portfolio",
  "leads",
  "trackers",
  "audit",
  "scout",
  "invoices",
  "academy",
  "settings",
] as const;

export const workspaceActionSchemas = [
  z.object({
    type: z.literal("create_lead"),
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(200).optional(),
    stage: z.enum(SALES_STAGES).optional(),
    next_follow_up: date.optional(),
    agreed_service: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(4000).optional(),
  }),
  z.object({
    type: z.literal("update_lead"),
    lead_id: id,
    stage: z.enum(SALES_STAGES).optional(),
    project_status: z.enum(PROJECT_STATUSES).optional(),
    next_follow_up: date.optional(),
    last_contact: date.optional(),
    agreed_service: z.string().trim().max(500).optional(),
    /** Appended to the lead's notes, never replacing them. */
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.literal("create_proposal"),
    title: z.string().trim().min(1).max(200),
    client_name: z.string().trim().max(160).optional(),
    client_email: z.string().trim().toLowerCase().email().max(254).optional(),
    subtitle: z.string().trim().max(300).optional(),
    body: z.string().trim().max(20000).optional(),
  }),
  z.object({
    type: z.literal("start_outreach_campaign"),
    genre: z.string().trim().min(2).max(120),
    count: z.number().int().min(1).max(50),
    prompt: z.string().trim().max(20000).optional(),
    sender_name: z.string().trim().max(100).optional(),
  }),
  z.object({
    type: z.literal("open_page"),
    page: z.enum([...new Set([...ADMIN_PAGES, ...EXPERT_PAGES])] as [string, ...string[]]),
  }),
] as const;

export type WorkspaceAction = z.infer<(typeof workspaceActionSchemas)[number]>;
export const WORKSPACE_ACTION_TYPES = [
  "create_lead",
  "update_lead",
  "create_proposal",
  "open_page",
];
export const WORKSPACE_SCHEMA_PROPS = {
  lead_id: { type: "string" },
  name: { type: "string" },
  email: { type: "string" },
  stage: { type: "string", enum: [...SALES_STAGES] },
  project_status: { type: "string", enum: [...PROJECT_STATUSES] },
  next_follow_up: { type: "string" },
  last_contact: { type: "string" },
  agreed_service: { type: "string" },
  notes: { type: "string" },
  note: { type: "string" },
  subtitle: { type: "string" },
  body: { type: "string" },
  page: { type: "string" },
  genre: { type: "string" },
  count: { type: "integer" },
  prompt: { type: "string" },
  sender_name: { type: "string" },
};

export const WORKSPACE_INSTRUCTIONS = `
Beyond trackers you can help across the whole HQ360 workspace:
- create_lead {name, email?, stage?, next_follow_up? (YYYY-MM-DD), agreed_service?, notes?} adds a lead to Leads & Projects.
- update_lead {lead_id, stage?, project_status?, next_follow_up?, last_contact?, agreed_service?, note?} updates a lead; "note" is appended to its notes with today's date.
- create_proposal {title, client_name?, client_email?, subtitle?, body?} saves a DRAFT proposal (nothing is sent). Write the body in Markdown, using only what the user told you.
- open_page {page} takes the user to a page of their workspace. Pages: PAGES.
Stages: ${SALES_STAGES.join(", ")}. Project statuses: ${PROJECT_STATUSES.join(", ")}.
Use WORKSPACE in CONTEXT to answer questions about leads, follow-ups, sales, proposals, quotes, audits and experts (summaries, what's due, what needs attention, drafting emails or messages). Only use lead_id values from WORKSPACE. You cannot send emails, take payments, approve experts or change access: say where in the workspace to do it and offer open_page.`;

const CAMPAIGN_INSTRUCTIONS = `
Author outreach campaigns (admin only):
- start_outreach_campaign {genre, count (1-50), prompt?, sender_name?} scouts \`count\` new authors in a Reedsy Discovery genre into a new Scouting batch, finds their emails, then drafts one personalised email per author from the admin's outreach prompt. Nothing is sent: the admin reviews every draft and presses Send in the campaign card.
- Before starting, make sure you know the genre, how many authors, and the admin's outreach prompt (the instructions they use to write personalised messages). If they have not given the prompt in this conversation, ask for it, and say they can also reply "use my saved prompt" (then send prompt empty and the card uses the saved one). Pass the prompt exactly as written. sender_name is the name signed under the email, if they give one.
- Email research and drafting use the admin's Perplexity key and cost a little per author; mention it once when you start.`;

export function workspaceInstructions(actor: Actor) {
  const pages = actor.role === "admin" ? ADMIN_PAGES : EXPERT_PAGES;
  return (
    WORKSPACE_INSTRUCTIONS.replace("PAGES", pages.join(", ")) +
    (actor.role === "admin" ? CAMPAIGN_INSTRUCTIONS : "")
  );
}

export type Campaign = {
  id: string;
  genre: string;
  count: number;
  prompt: string;
  senderName: string;
};

async function permissions(actor: Actor) {
  if (actor.role === "admin") return null;
  const { data } = await db()
    .from("expert_profiles")
    .select("permissions")
    .eq("id", actor.expertId)
    .maybeSingle();
  return ((data as { permissions?: string[] } | null)?.permissions ?? []) as string[];
}

const owner = (actor: Actor) => (actor.role === "admin" ? "hq360" : actor.expertId);
const fmt = (minor: number, currency = "USD") =>
  `${currency} ${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** A compact snapshot of the workspace for the model. Failures just leave a section out. */
export async function workspaceContext(actor: Actor) {
  const d = db();
  const perms = await permissions(actor);
  const sales = perms === null || perms.includes("invoices");
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  let leadsQuery = d
    .from("sales_leads")
    .select("id, name, email, stage, project_status, next_follow_up, agreed_service, owner")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (actor.role === "expert") leadsQuery = leadsQuery.eq("owner", actor.expertId);
  const { data: leads } = await leadsQuery;
  const leadRows = (leads ?? []) as Record<string, string | null>[];
  lines.push(
    `Leads (${leadRows.length} most recent):`,
    ...leadRows.map(
      (l) =>
        `- lead_id ${l.id}: ${l.name}${l.email ? ` <${l.email}>` : ""}, stage ${l.stage}, project ${l.project_status}${l.next_follow_up ? `, follow up ${l.next_follow_up}${l.next_follow_up <= today && l.stage !== "lost" ? " (DUE)" : ""}` : ""}${l.agreed_service ? `, service "${l.agreed_service}"` : ""}${actor.role === "admin" && l.owner !== "hq360" ? " (expert's lead)" : ""}`,
    ),
  );

  if (sales) {
    let proposals = d
      .from("proposals")
      .select("title, client_name, sent_at, views, updated_at")
      .order("updated_at", { ascending: false })
      .limit(10);
    let quotes = d
      .from("price_quotes")
      .select("client_name, project_title, views, valid_until")
      .order("updated_at", { ascending: false })
      .limit(10);
    if (actor.role === "expert") {
      proposals = proposals.eq("owner", owner(actor));
      quotes = quotes.eq("owner", owner(actor));
    }
    const [p, q] = await Promise.all([proposals, quotes]);
    lines.push(
      "Proposals (latest):",
      ...((p.data ?? []) as Record<string, string | number | null>[]).map(
        (x) =>
          `- "${x.title}" for ${x.client_name || "no client"}, ${x.sent_at ? "sent" : "draft"}, ${x.views ?? 0} views`,
      ),
      "Quotes (latest):",
      ...((q.data ?? []) as Record<string, string | number | null>[]).map(
        (x) =>
          `- ${x.client_name}: "${x.project_title}", ${x.views ?? 0} views${x.valid_until ? `, valid until ${x.valid_until}` : ""}`,
      ),
    );
  }

  if (actor.role === "admin") {
    const [invoices, requests, experts, audits] = await Promise.all([
      d
        .from("payment_invoices")
        .select("number, buyer_name, amount_minor, currency, status, environment")
        .order("created_at", { ascending: false })
        .limit(40),
      d
        .from("expert_invoice_requests")
        .select("buyer_name, amount_minor, status")
        .eq("status", "pending"),
      d.from("expert_profiles").select("full_name, email, status, is_guest").limit(300),
      d
        .from("author_audits")
        .select("status, authors(name)")
        .in("status", ["needs_verification", "ready_for_review"])
        .limit(20),
    ]);
    const inv = (invoices.data ?? []) as {
      number: string;
      buyer_name: string;
      amount_minor: number;
      currency: string;
      status: string;
    }[];
    const total = (status: string) =>
      fmt(
        inv
          .filter((i) => i.status === status && i.currency === "USD")
          .reduce((s, i) => s + i.amount_minor, 0),
      );
    lines.push(
      `Invoices: ${total("paid")} paid and ${total("pending")} awaiting payment (USD, last 40). Latest:`,
      ...inv
        .slice(0, 8)
        .map((i) => `- ${i.number} ${i.buyer_name} ${fmt(i.amount_minor, i.currency)} ${i.status}`),
      `Invoice requests from experts waiting: ${(requests.data ?? []).length}`,
    );
    const ex = (experts.data ?? []) as {
      full_name: string | null;
      email: string;
      status: string;
      is_guest: boolean;
    }[];
    const pending = ex.filter((e) => e.status === "pending");
    lines.push(
      `Experts: ${ex.filter((e) => e.status === "approved" && !e.is_guest).length} approved, ${ex.filter((e) => e.is_guest).length} guests, ${pending.length} waiting for approval${
        pending.length
          ? ` (${pending
              .slice(0, 5)
              .map((e) => e.full_name || e.email)
              .join(", ")})`
          : ""
      }`,
      `Audits awaiting review: ${((audits.data ?? []) as unknown as { authors: { name: string } | null }[]).map((a) => a.authors?.name ?? "unnamed").join(", ") || "none"}`,
    );
  } else if (sales) {
    const { data } = await d
      .from("expert_invoice_requests")
      .select("buyer_name, amount_minor, status")
      .eq("expert_id", actor.expertId)
      .order("created_at", { ascending: false })
      .limit(10);
    lines.push(
      "Your invoice requests:",
      ...((data ?? []) as { buyer_name: string; amount_minor: number; status: string }[]).map(
        (r) => `- ${r.buyer_name} ${fmt(r.amount_minor)} ${r.status}`,
      ),
    );
  }
  if (perms)
    lines.push(`Tools this expert has: ${perms.join(", ") || "none beyond the core workspace"}`);
  return `WORKSPACE\n${lines.join("\n")}`;
}

export type WorkspaceResult = {
  ok: boolean;
  text: string;
  link?: string;
  open?: string;
  campaign?: Campaign;
};

export async function runWorkspaceAction(
  actor: Actor,
  action: WorkspaceAction,
): Promise<WorkspaceResult> {
  const d = db();
  switch (action.type) {
    case "open_page": {
      const pages: readonly string[] = actor.role === "admin" ? ADMIN_PAGES : EXPERT_PAGES;
      if (!pages.includes(action.page))
        return { ok: false, text: "That page isn't in this workspace." };
      return { ok: true, text: `Opening ${action.page}.`, open: action.page };
    }
    case "start_outreach_campaign": {
      if (actor.role !== "admin")
        return { ok: false, text: "Outreach campaigns are available in the admin workspace." };
      const { randomUUID } = await import("node:crypto");
      return {
        ok: true,
        text: `Campaign ready: ${action.count} ${action.genre} authors. Follow the steps below; nothing is sent until you approve it.`,
        campaign: {
          id: randomUUID(),
          genre: action.genre,
          count: action.count,
          prompt: action.prompt ?? "",
          senderName: action.sender_name ?? "",
        },
      };
    }
    case "create_lead": {
      const { error } = await d.from("sales_leads").insert({
        name: action.name,
        email: action.email ?? "",
        stage: action.stage ?? "needs_review",
        next_follow_up: action.next_follow_up ?? null,
        agreed_service: action.agreed_service ?? "",
        notes: action.notes ?? "",
        source_kind: "manual",
        owner: owner(actor),
      });
      if (error) throw new TrackerError("Could not save the lead.", 503);
      return {
        ok: true,
        text: `Added ${action.name} to Leads & Projects.`,
        open: actor.role === "admin" ? "projects" : "leads",
      };
    }
    case "update_lead": {
      const { data: lead } = await d
        .from("sales_leads")
        .select("id, name, owner, notes")
        .eq("id", action.lead_id)
        .maybeSingle();
      const row = lead as { id: string; name: string; owner: string; notes: string | null } | null;
      if (!row || (actor.role === "expert" && row.owner !== actor.expertId))
        return { ok: false, text: "Lead not found." };
      const { type: _t, lead_id: _id, note, ...rest } = action;
      const patch: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      if (note) {
        const stamp = new Date().toISOString().slice(0, 10);
        patch.notes = [row.notes?.trim(), `${stamp}: ${note}`].filter(Boolean).join("\n");
      }
      if (!Object.keys(patch).length) return { ok: false, text: "Nothing to change on that lead." };
      const { error } = await d
        .from("sales_leads")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw new TrackerError("Could not update the lead.", 503);
      return { ok: true, text: `Updated ${row.name}.` };
    }
    case "create_proposal": {
      const perms = await permissions(actor);
      if (perms && !perms.includes("invoices"))
        return { ok: false, text: "Proposals need the Sales tool, which you don't have yet." };
      const { data: me } =
        actor.role === "expert"
          ? await d
              .from("expert_profiles")
              .select("full_name, email")
              .eq("id", actor.expertId)
              .maybeSingle()
          : { data: null };
      const author = me as { full_name: string | null; email: string } | null;
      const { data, error } = await d
        .from("proposals")
        .insert({
          title: action.title,
          client_name: action.client_name ?? "",
          client_email: action.client_email ?? "",
          subtitle: action.subtitle ?? "",
          details: [],
          body: action.body ?? "",
          prepared_by: actor.role === "admin" ? "HQ360" : author?.full_name || author?.email || "",
          prepared_by_role: "",
          footer_note: "",
          owner: owner(actor),
        })
        .select("token")
        .single();
      if (error || !data) throw new TrackerError("Could not save the proposal.", 503);
      const { proposalLink } = await import("@/lib/proposals.server");
      return {
        ok: true,
        text: `Saved a draft proposal "${action.title}". Review it in Sales before sending.`,
        link: proposalLink((data as { token: string }).token),
        open: actor.role === "admin" ? "proposals" : "invoices",
      };
    }
  }
}
