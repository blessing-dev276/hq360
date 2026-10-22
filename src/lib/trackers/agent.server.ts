import { z } from "zod";
import { runAgent, PerplexityError } from "@/lib/perplexity/agent.server";
import { DEFAULT_AGENT_MODEL, isAgentModel } from "./agent-models";
import * as svc from "./service.server";
import type { Actor } from "./service.server";

// Client tracking assistant. The model never touches the database: it returns
// a reply plus a list of actions, each action is validated here and run
// through the same service functions (and ownership checks) as the manual UI.

export type ChatMessage = { role: "user" | "assistant"; content: string };
/** data:image/(png|jpeg|webp);base64,... screenshots sent with the latest message. */
export type ChatImage = string;

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Stores screenshots privately for the length of one request and returns short-lived links. */
async function stageImages(actor: Actor, images: ChatImage[]) {
  const { randomUUID } = await import("node:crypto");
  const owner = actor.role === "expert" ? actor.expertId : "admin";
  const keys: string[] = [];
  const urls: string[] = [];
  try {
    for (const image of images) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
      if (!match) throw new svc.TrackerError("Screenshots must be PNG, JPEG or WebP images.", 400);
      const bytes = Buffer.from(match[2]!, "base64");
      if (bytes.length > MAX_IMAGE_BYTES)
        throw new svc.TrackerError("Each screenshot must be under 5 MB.", 400);
      const key = `assistant/${owner}/${randomUUID()}.${IMAGE_TYPES[match[1]!]}`;
      const storage = svc.db().storage.from(svc.BUCKET);
      const { error } = await storage.upload(key, bytes, { contentType: match[1]!, upsert: false });
      if (error) throw new svc.TrackerError("Could not read the screenshot. Please try again.", 503);
      keys.push(key);
      const signed = await storage.createSignedUrl(key, 600);
      if (signed.error || !signed.data) throw new svc.TrackerError("Could not read the screenshot.", 503);
      urls.push(signed.data.signedUrl);
    }
  } catch (e) {
    await removeImages(keys);
    throw e;
  }
  return { keys, urls };
}
async function removeImages(keys: string[]) {
  if (keys.length) await svc.db().storage.from(svc.BUCKET).remove(keys).catch(() => {});
}
export type ActionResult = {
  ok: boolean;
  text: string;
  trackerId?: string;
  link?: string;
  passcode?: string;
};

const id = z.string().uuid();
const NEW = z.literal("NEW");
const trackerRef = z.union([id, NEW]);
const short = (n: number) => z.string().trim().min(1).max(n);

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_tracker"),
    client_name: short(120),
    client_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    project_title: short(160),
    package_name: z.string().trim().max(120).optional(),
    passcode: z.string().trim().min(4).max(64).optional(),
    expert_id: id.optional(),
  }),
  z.object({
    type: z.literal("update_tracker"),
    tracker_id: trackerRef,
    client_name: short(120).optional(),
    client_email: z.string().trim().email().max(200).optional(),
    project_title: short(160).optional(),
    package_name: z.string().trim().max(120).optional(),
  }),
  z.object({
    type: z.literal("add_item"),
    tracker_id: trackerRef,
    title: short(160),
    description: z.string().trim().max(2000).optional(),
    is_free_bonus: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("update_item"),
    tracker_id: trackerRef,
    item_id: id,
    title: short(160).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(["next", "progress", "done"]).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  }),
  z.object({ type: z.literal("delete_item"), tracker_id: trackerRef, item_id: id }),
  z.object({
    type: z.literal("add_update"),
    tracker_id: trackerRef,
    text: short(1500),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({ type: z.literal("publish"), tracker_id: trackerRef, notify_client: z.boolean().optional() }),
  z.object({
    type: z.literal("replace_passcode"),
    tracker_id: trackerRef,
    passcode: z.string().trim().min(4).max(64).optional(),
  }),
  z.object({ type: z.literal("get_link"), tracker_id: trackerRef }),
]);
type Action = z.infer<typeof actionSchema>;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "create_tracker",
              "update_tracker",
              "add_item",
              "update_item",
              "delete_item",
              "add_update",
              "publish",
              "replace_passcode",
              "get_link",
            ],
          },
          tracker_id: { type: "string" },
          item_id: { type: "string" },
          expert_id: { type: "string" },
          client_name: { type: "string" },
          client_email: { type: "string" },
          project_title: { type: "string" },
          package_name: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["next", "progress", "done"] },
          progress: { type: "integer" },
          is_free_bonus: { type: "boolean" },
          text: { type: "string" },
          date: { type: "string" },
          passcode: { type: "string" },
          notify_client: { type: "boolean" },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};

const INSTRUCTIONS = `You are the HQ360 Client tracking assistant. You help an expert manage private, passcode protected progress pages ("trackers") for their clients.

You answer with JSON only: {"reply": string, "actions": [...]}. "reply" is a short, friendly message to the expert in plain English. "actions" are changes you want made; the app runs them after you answer and shows the results (link, passcode, errors) to the expert, so do not invent links, passcodes or ids.

Actions:
- create_tracker {client_name, project_title, client_email?, package_name?, passcode?${""}} creates a tracker. Later actions in the same answer refer to it with tracker_id "NEW".
- update_tracker {tracker_id, client_name?, client_email?, project_title?, package_name?}
- add_item {tracker_id, title, description?, is_free_bonus?} adds a deliverable.
- update_item {tracker_id, item_id, title?, description?, status? ("next"|"progress"|"done"), progress? (0-100)}
- delete_item {tracker_id, item_id}
- add_update {tracker_id, text, date? (YYYY-MM-DD)} adds a progress log entry the client will read.
- publish {tracker_id, notify_client?} makes the current content visible on the client's link. Clients see nothing new until you publish.
- replace_passcode {tracker_id, passcode?} sets a new passcode (generated if empty).
- get_link {tracker_id} shows the link and current passcode.

Rules:
- Use only tracker_id and item_id values from CONTEXT (or "NEW"). If the expert's request is ambiguous (which client? which item?), ask in "reply" and send no actions.
- After changing a tracker's content, add a publish action unless the expert says not to. New trackers are published automatically.
- Never claim results the client did not give: no invented numbers, rankings, reviews or quotes in items or updates.
- Never delete anything unless the expert clearly asked.
- If the expert only asks a question, answer it with no actions.

Screenshots: the expert may attach screenshots (for example a ranking list, sales dashboard, reviews page, chat with the client, a checklist or a brief). Read them carefully. Describe what you see that matters in "reply", then turn it into actions when the expert asks (or clearly wants) the tracker updated: e.g. mark items done or set progress, add an update quoting exactly what the screenshot shows, or create a tracker and items from a brief. Use only facts visible in the screenshot or given by the expert; if something is unreadable or unclear, say so instead of guessing.`;

async function context(actor: Actor) {
  const trackers = (await svc.listTrackers(actor)).slice(0, 30);
  const ids = trackers.map((t) => t.id);
  const { data: items } = ids.length
    ? await svc
        .db()
        .from("tracker_items")
        .select("id, tracker_id, position, title, status, progress, is_free_bonus")
        .in("tracker_id", ids)
        .order("position")
    : { data: [] };
  const lines = trackers.map((t) => {
    const own = (items ?? []).filter((i) => i.tracker_id === t.id);
    return [
      `- tracker_id ${t.id}: client "${t.client_name}"${t.client_email ? ` <${t.client_email}>` : ""}, project "${t.project_title}", package "${t.package_name}", status ${t.status}, progress ${t.progress}%, published ${t.published_at ? "yes" : "no"}`,
      ...own.map(
        (i) =>
          `    - item_id ${i.id}: "${i.title}" ${i.status} ${i.progress}%${i.is_free_bonus ? " (free bonus)" : ""}`,
      ),
    ].join("\n");
  });
  let experts = "";
  if (actor.role === "admin") {
    const { data } = await svc
      .db()
      .from("expert_profiles")
      .select("id, full_name, email")
      .eq("status", "approved")
      .eq("is_guest", false)
      .order("full_name")
      .limit(100);
    experts =
      "\nYou are acting as the admin. create_tracker needs expert_id: the expert who owns the tracker. Experts:\n" +
      (data ?? []).map((e) => `- expert_id ${e.id}: ${e.full_name || e.email}`).join("\n");
  }
  return `CONTEXT (today is ${new Date().toISOString().slice(0, 10)})\nTrackers:\n${lines.join("\n") || "(none yet)"}${experts}`;
}

async function perplexityKey(actor: Actor) {
  const c = await import("@/lib/perplexity/credentials.server");
  if (actor.role === "admin") return c.adminKeyForResearch();
  const key = await c.loadExpertKey(actor.expertId);
  if (!key)
    throw new svc.TrackerError(
      "Add your Perplexity key in Settings → AI keys to use the assistant.",
      409,
    );
  return key;
}

function parseModelJson(text: string): { reply: string; actions: unknown[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { reply?: unknown; actions?: unknown };
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : "",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { reply: text.trim(), actions: [] };
  }
}

async function linkAndPasscode(actor: Actor, trackerId: string) {
  const detail = await svc.trackerDetail(actor, trackerId);
  const passcode = detail.tracker.passcode;
  return passcode ? { link: detail.tracker.url, passcode } : { link: detail.tracker.url };
}

async function runAction(
  actor: Actor,
  action: Action,
  state: { created: string | null },
): Promise<ActionResult> {
  const ref = "tracker_id" in action ? action.tracker_id : null;
  const trackerId = ref === "NEW" ? state.created : ref;
  if ("tracker_id" in action && !trackerId)
    return { ok: false, text: "No new tracker was created in this answer." };
  const t = trackerId as string;
  switch (action.type) {
    case "create_tracker": {
      const result = await svc.createTracker(actor, {
        clientName: action.client_name,
        clientEmail: action.client_email ?? "",
        projectTitle: action.project_title,
        packageName: action.package_name ?? "",
        ...(action.passcode ? { passcode: action.passcode } : {}),
        ...(action.expert_id ? { expertId: action.expert_id } : {}),
      });
      state.created = result.tracker.id;
      return {
        ok: true,
        text: `Created tracker for ${action.client_name}.`,
        trackerId: result.tracker.id,
        link: result.url,
        passcode: result.passcode,
      };
    }
    case "update_tracker": {
      const { type: _t, tracker_id: _id, ...rest } = action;
      const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      await svc.updateTracker(actor, t, patch);
      return { ok: true, text: "Updated the tracker details.", trackerId: t };
    }
    case "add_item":
      await svc.addItem(actor, t, {
        title: action.title,
        ...(action.description ? { description: action.description } : {}),
        ...(action.is_free_bonus !== undefined ? { is_free_bonus: action.is_free_bonus } : {}),
      });
      return { ok: true, text: `Added "${action.title}".`, trackerId: t };
    case "update_item": {
      const { type: _t, tracker_id: _id, item_id, ...rest } = action;
      const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      await svc.updateItem(actor, t, item_id, patch);
      return { ok: true, text: "Updated an item.", trackerId: t };
    }
    case "delete_item":
      await svc.deleteItem(actor, t, action.item_id);
      return { ok: true, text: "Deleted an item.", trackerId: t };
    case "add_update":
      await svc.addLogEntry(actor, t, { text: action.text, ...(action.date ? { date: action.date } : {}) });
      return { ok: true, text: "Added a progress update.", trackerId: t };
    case "publish": {
      const result = await svc.publishTracker(actor, t, Boolean(action.notify_client));
      return {
        ok: true,
        text: `Published.${result.notified ? " The client was emailed the link." : ""}`,
        trackerId: t,
        ...(await linkAndPasscode(actor, t)),
      };
    }
    case "replace_passcode": {
      const passcode = await svc.resetPasscode(actor, t, action.passcode);
      return { ok: true, text: "New passcode set.", trackerId: t, passcode, link: (await linkAndPasscode(actor, t)).link };
    }
    case "get_link":
      return { ok: true, text: "Link and passcode:", trackerId: t, ...(await linkAndPasscode(actor, t)) };
  }
}

export async function chat(
  actor: Actor,
  messages: ChatMessage[],
  model: string,
  images: ChatImage[] = [],
  deps: { run?: typeof runAgent; key?: (a: Actor) => Promise<string> } = {},
) {
  const chosen = isAgentModel(model) ? model : DEFAULT_AGENT_MODEL;
  const key = await (deps.key ?? perplexityKey)(actor);
  const transcript = messages
    .slice(-20)
    .map((m) => `${m.role === "user" ? "EXPERT" : "ASSISTANT"}: ${m.content.slice(0, 4000)}`)
    .join("\n\n");
  const prompt = `${await context(actor)}\n\nCONVERSATION\n${transcript}\n\n${images.length ? `The last EXPERT message has ${images.length} screenshot(s) attached. ` : ""}Answer the last EXPERT message.`;
  const staged = images.length ? await stageImages(actor, images) : { keys: [], urls: [] };
  let response;
  try {
    response = await (deps.run ?? runAgent)(
      {
        model: chosen,
        instructions: INSTRUCTIONS,
        input: staged.urls.length
          ? [
              {
                type: "message",
                role: "user",
                content: [
                  { type: "input_text", text: prompt },
                  ...staged.urls.map((url) => ({ type: "input_image" as const, image_url: url })),
                ],
              },
            ]
          : prompt,
        tools: [],
        max_steps: 1,
        max_output_tokens: 4000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "tracker_assistant", schema: RESPONSE_SCHEMA },
        },
      },
      fetch,
      { apiKey: key },
    );
  } catch (e) {
    if (e instanceof PerplexityError)
      throw new svc.TrackerError(
        staged.urls.length && e.upstreamStatus === 400
          ? "This model could not read the screenshot. Pick another model (GPT, Claude or Gemini) and try again."
          : e.message,
        e.status,
      );
    throw e;
  } finally {
    await removeImages(staged.keys);
  }
  const { reply, actions } = parseModelJson(response.text);
  const state = { created: null as string | null };
  const results: ActionResult[] = [];
  for (const raw of actions.slice(0, 25)) {
    const parsed = actionSchema.safeParse(
      Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).filter(([, v]) => v !== "" && v !== null),
      ),
    );
    if (!parsed.success) {
      results.push({ ok: false, text: "Skipped an action the assistant described incorrectly." });
      continue;
    }
    try {
      results.push(await runAction(actor, parsed.data, state));
    } catch (e) {
      results.push({ ok: false, text: e instanceof Error ? e.message : "That action failed." });
    }
  }
  // A new tracker's link should work straight away.
  if (state.created && !actions.some((a) => (a as { type?: string }).type === "publish")) {
    try {
      await svc.publishTracker(actor, state.created, false);
      results.push({
        ok: true,
        text: "Published, so the link works now.",
        trackerId: state.created,
        ...(await linkAndPasscode(actor, state.created)),
      });
    } catch (e) {
      results.push({ ok: false, text: e instanceof Error ? e.message : "Could not publish." });
    }
  }
  return {
    reply: reply || (results.length ? "Done." : "I could not work that out. Could you rephrase?"),
    results,
    model: chosen,
    ...(response.costUsd !== undefined ? { costUsd: response.costUsd } : {}),
  };
}
