import { z } from "zod";
import { STATUS_LABEL, type ItemStatus } from "./core";
import type { AiProvider } from "./ai-keys.server";
import { addLogEntry, authorOf, db, ownedTracker, TrackerError, updateItem, type Actor } from "./service.server";

// AI assisted tracker updates with the expert's own key. Every result is a
// draft in tracker_ai_drafts. Nothing here writes to items, the log or the
// published page: approveDraft (a person) and then Publish (a person) do.

export const AI_ACTIONS = ["draft_update", "friendly_rewrite", "progress_summary", "portfolio_blurb"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: process.env.AI_MODEL_ANTHROPIC || "claude-sonnet-5-5",
  openai: process.env.AI_MODEL_OPENAI || "gpt-5-mini",
  google: process.env.AI_MODEL_GOOGLE || "gemini-2.5-flash",
  perplexity: process.env.AI_MODEL_PERPLEXITY || "sonar",
};

export const SYSTEM_RULES = `You write short updates that an HQ360 expert sends to an author client about their project.
Rules you must follow:
- Never invent results, numbers, rankings, dates, prices or quotes. Use only facts written in the input.
- If a figure is not in the input, leave it out. Do not estimate or round.
- Never include passcodes, payment details, email addresses or private notes.
- Plain, warm, simple English. No jargon. No dashes. No contractions (write "I would", not "I'd").
- Reply with JSON only, using exactly the keys you are asked for.`;

type Prompt = { user: string; keys: string[] };

export function buildPrompt(action: AiAction, context: string): Prompt {
  switch (action) {
    case "draft_update":
      return {
        keys: ["log_entry", "description"],
        user: `Turn the expert's rough notes into (1) "log_entry": one dated update line for the client, one sentence, and (2) "description": an updated item description of two or three sentences.\n\n${context}`,
      };
    case "friendly_rewrite":
      return {
        keys: ["text"],
        user: `Rewrite this item text for the client in plain, warm wording with no jargon. Keep every fact and add none. Return {"text": "..."}.\n\n${context}`,
      };
    case "progress_summary":
      return {
        keys: ["text"],
        user: `Write one short paragraph (three to five sentences) the expert can put in an email to the client summarising where the project stands. Return {"text": "..."}.\n\n${context}`,
      };
    case "portfolio_blurb":
      return {
        keys: ["text"],
        user: `Write a two or three sentence case study about this finished piece of work for the expert's public portfolio. Leave out anything private: no email addresses, no payment details, no internal notes, no unpublished manuscript text. Return {"text": "..."}.\n\n${context}`,
      };
  }
}

/** Numbers (including #1, 65%, 2026) and quoted phrases in the draft that the
 *  expert never supplied. Any hit means the model made something up. */
export function unsupportedClaims(output: string, input: string) {
  const figures = (text: string) =>
    new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/[.,]/g, "")));
  const given = figures(input);
  const invented = [...figures(output)].filter((n) => !given.has(n));
  const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const quotes = (output.match(/[“"]([^”"]{8,})[”"]/g) ?? [])
    .map((q) => q.slice(1, -1))
    .filter((q) => !normal(input).includes(normal(q)));
  return { figures: invented, quotes };
}

export type ProviderCall = {
  plainText?: boolean;
  provider: AiProvider;
  apiKey: string;
  model: string;
  system: string;
  user: string;
};
export type ProviderResult = { text: string; inputTokens: number; outputTokens: number };

/** One server side request. The key travels only in a request header. */
export async function callProvider(call: ProviderCall, fetcher: typeof fetch = fetch): Promise<ProviderResult> {
  let response: Response;
  if (call.provider === "anthropic") {
    response = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": call.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: call.model,
        max_tokens: 800,
        system: call.system,
        messages: [{ role: "user", content: call.user }],
      }),
    });
  } else if (call.provider === "openai") {
    response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${call.apiKey}` },
      body: JSON.stringify({
        model: call.model,
        ...(call.plainText ? {} : { response_format: { type: "json_object" } }),
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.user },
        ],
      }),
    });
  } else if (call.provider === "google") {
    response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(call.model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": call.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: call.system }] },
          contents: [{ role: "user", parts: [{ text: call.user }] }],
          generationConfig: { ...(call.plainText ? {} : { responseMimeType: "application/json" }), maxOutputTokens: 800 },
        }),
      },
    );
  } else {
    response = await fetcher("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${call.apiKey}` },
      body: JSON.stringify({
        model: call.model,
        ...(call.plainText ? {} : { response_format: { type: "json_object" } }),
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.user },
        ],
      }),
    });
  }
  if (response.status === 401 || response.status === 403)
    throw new TrackerError("Your AI provider rejected the key. Replace it in Settings → AI keys.", 409);
  if (!response.ok) throw new TrackerError("The AI provider did not answer. Please try again.", 502);
  const body = (await response.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (call.provider === "anthropic")
    return {
      text: (body.content ?? []).map((part: { text?: string }) => part.text ?? "").join(""),
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    };
  if (call.provider === "openai")
    return {
      text: body.choices?.[0]?.message?.content ?? "",
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  if (call.provider === "perplexity")
    return {
      text: body.choices?.[0]?.message?.content ?? "",
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  return {
    text: (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join(""),
    inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export function parseDraft(text: string, keys: string[]) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const parsed = start >= 0 && end > start ? (JSON.parse(text.slice(start, end + 1)) as unknown) : null;
  const shape = z.object(Object.fromEntries(keys.map((k) => [k, z.string().trim().min(1).max(1500)])));
  const result = shape.safeParse(parsed);
  if (!result.success) throw new TrackerError("The AI draft came back in the wrong shape. Please try again.", 502);
  return result.data as Record<string, string>;
}

type Item = { id: string; title: string; status: ItemStatus; progress: number; description: string };

/** The facts the model may use. Client email, passcode and payments are never included. */
export async function contextFor(
  action: AiAction,
  trackerId: string,
  input: { notes?: string; text?: string; itemId?: string },
  naming: { allowed: boolean; clientName: string; projectTitle: string },
) {
  const { data: items } = await db()
    .from("tracker_items")
    .select("id, title, status, progress, description")
    .eq("tracker_id", trackerId)
    .order("position");
  const all = (items ?? []) as Item[];
  const item = input.itemId ? all.find((i) => i.id === input.itemId) : undefined;
  if (input.itemId && !item) throw new TrackerError("Item not found.", 404);
  const line = (i: Item) => `- ${i.title} (${STATUS_LABEL[i.status]}, ${i.progress}%): ${i.description}`;
  switch (action) {
    case "draft_update":
      return `Item: ${item ? `${item.title}\nCurrent description: ${item.description}` : "(general update)"}\nExpert's notes: ${input.notes ?? ""}`;
    case "friendly_rewrite":
      return `Text: ${input.text ?? item?.description ?? ""}`;
    case "progress_summary": {
      const { data: log } = await db()
        .from("tracker_log_entries")
        .select("entry_date, text")
        .eq("tracker_id", trackerId)
        .order("entry_date", { ascending: false })
        .limit(8);
      return `Project: ${naming.projectTitle}\nClient first name: ${naming.clientName.split(/\s+/)[0]}\nItems:\n${all.map(line).join("\n")}\nRecent updates:\n${(log ?? []).map((l) => `- ${l.entry_date}: ${l.text}`).join("\n")}`;
    }
    case "portfolio_blurb":
      if (!item || item.status !== "done") throw new TrackerError("Pick a completed item.", 400);
      return `Finished work: ${item.title}\nWhat was delivered: ${item.description}\n${
        naming.allowed ? `Client or book (may be named): ${naming.clientName}, ${naming.projectTitle}` : "Do not name the client or the book."
      }`;
  }
}

export type AiDeps = {
  loadKey: (actor: Actor) => Promise<{ provider: AiProvider; key: string } | null>;
  call: (call: ProviderCall) => Promise<ProviderResult>;
};

export async function chatHistory(actor: Actor, trackerId: string) {
  await ownedTracker(actor, trackerId);
  const { data, error } = await db().from("tracker_ai_messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("tracker_id", trackerId).order("created_at", { ascending: true }).limit(500);
  if (error) throw new TrackerError("Could not load AI chat history.", 503);
  return data ?? [];
}

export async function chatWithTracker(actor: Actor, trackerId: string, conversationId: string, message: string) {
  const tracker = await ownedTracker(actor, trackerId);
  const { loadAiKey } = await import("./ai-keys.server");
  const credential = await loadAiKey(actor);
  if (!credential) throw new TrackerError("Add an AI key in Settings first.", 409);
  const { data: history, error: historyError } = await db().from("tracker_ai_messages")
    .select("role, content").eq("tracker_id", trackerId).eq("conversation_id", conversationId)
    .order("created_at", { ascending: true }).limit(40);
  if (historyError) throw new TrackerError("Could not load this conversation.", 503);
  const context = await contextFor("progress_summary", trackerId, {}, {
    allowed: tracker.consent_allows_naming, clientName: tracker.client_name, projectTitle: tracker.project_title,
  });
  const exchange = (history ?? []).map((entry) => `${entry.role === "user" ? "Expert" : "Assistant"}: ${entry.content}`).join("\n\n");
  const result = await callProvider({ provider: credential.provider, apiKey: credential.key,
    model: DEFAULT_MODELS[credential.provider],
    system: `${SYSTEM_RULES}\nFor this conversation, reply in plain text. You are helping the expert plan and write updates. Your replies are private and never published automatically.`,
    user: `Current tracker facts:\n${context}\n\nPrevious conversation:\n${exchange}\n\nExpert: ${message}\nAssistant:`,
    plainText: true,
  });
  const reply = result.text.trim().slice(0, 8000);
  if (!reply) throw new TrackerError("The assistant returned an empty reply. Please try again.", 502);
  const claims = unsupportedClaims(reply, `${context}\n${exchange}\n${message}`);
  if (claims.figures.length) throw new TrackerError("The assistant included an unsupported figure. Please retry.", 422);
  const { error } = await db().from("tracker_ai_messages").insert([
    { tracker_id: trackerId, conversation_id: conversationId, role: "user", content: message },
    { tracker_id: trackerId, conversation_id: conversationId, role: "assistant", content: reply },
  ]);
  if (error) throw new TrackerError("Could not save the conversation.", 503);
  return { reply };
}

/** Runs one AI action with the actor's own key: an expert on their own tracker,
 *  or admin (any tracker) with admin's key. Nobody ever uses an expert's key but that expert. */
export async function runAiAction(
  actor: Actor,
  trackerId: string,
  action: AiAction,
  input: { notes?: string; text?: string; itemId?: string },
  deps: AiDeps,
) {
  // Ownership first: an expert's key can never be spent on someone else's tracker.
  const tracker = await ownedTracker(actor, trackerId);
  const credential = await deps.loadKey(actor);
  if (!credential) throw new TrackerError("Add a Perplexity key in Settings → AI keys first.", 409);
  const context = await contextFor(action, trackerId, input, {
    allowed: tracker.consent_allows_naming,
    clientName: tracker.client_name,
    projectTitle: tracker.project_title,
  });
  const prompt = buildPrompt(action, context);
  const model = DEFAULT_MODELS[credential.provider];
  let result: ProviderResult | null = null;
  try {
    result = await deps.call({ provider: credential.provider, apiKey: credential.key, model, system: SYSTEM_RULES, user: prompt.user });
    const output = parseDraft(result.text, prompt.keys);
    const claims = unsupportedClaims(Object.values(output).join("\n"), context);
    if (claims.figures.length || claims.quotes.length)
      throw new TrackerError(
        "The AI draft included a figure or quote you did not give, so it was not saved. Try again or write it yourself.",
        422,
      );
    const { data, error } = await db()
      .from("tracker_ai_drafts")
      .insert({
        tracker_id: trackerId,
        item_id: input.itemId ?? null,
        action,
        input: (input.notes ?? input.text ?? "").slice(0, 8000),
        output,
        status: "pending",
        created_by: authorOf(actor),
        created_by_admin: actor.role === "admin",
      })
      .select("id, item_id, action, input, output, status, created_at")
      .maybeSingle();
    if (error || !data) throw new TrackerError("Could not save the draft.", 503);
    await logUsage(actor, trackerId, action, credential.provider, model, result, true);
    return data;
  } catch (error) {
    await logUsage(actor, trackerId, action, credential.provider, model, result, false);
    throw error;
  }
}

async function logUsage(
  actor: Actor,
  trackerId: string,
  action: AiAction,
  provider: AiProvider,
  model: string,
  result: ProviderResult | null,
  ok: boolean,
) {
  await db()
    .from("expert_ai_usage")
    .insert({
      expert_id: authorOf(actor),
      actor: actor.role,
      tracker_id: trackerId,
      action,
      provider,
      model,
      input_tokens: result?.inputTokens ?? 0,
      output_tokens: result?.outputTokens ?? 0,
      ok,
    });
}

export async function aiUsage(actor: Actor) {
  const { data, error } = await db()
    .from("expert_ai_usage")
    .select("created_at, tracker_id, action, provider, model, input_tokens, output_tokens, ok")
    .match(actor.role === "expert" ? { expert_id: actor.expertId } : { actor: "admin" })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new TrackerError("Could not load your AI usage.", 503);
  return data ?? [];
}

async function ownedDraft(actor: Actor, trackerId: string, draftId: string) {
  await ownedTracker(actor, trackerId);
  const { data } = await db()
    .from("tracker_ai_drafts")
    .select("id, item_id, action, output, status")
    .eq("id", draftId)
    .eq("tracker_id", trackerId)
    .maybeSingle();
  if (!data) throw new TrackerError("Draft not found.", 404);
  if (data.status !== "pending") throw new TrackerError("This draft was already handled.", 409);
  return data as { id: string; item_id: string | null; action: AiAction; output: Record<string, string>; status: string };
}

/** A person approves (optionally after editing). The change goes into the
 *  working copy only; the client sees it after the expert publishes. */
export async function approveDraft(
  actor: Actor,
  trackerId: string,
  draftId: string,
  edited?: Record<string, string>,
) {
  const draft = await ownedDraft(actor, trackerId, draftId);
  const output = { ...draft.output, ...(edited ?? {}) };
  if (draft.action === "draft_update") {
    if (output.log_entry) await addLogEntry(actor, trackerId, { text: output.log_entry, source: "ai" });
    if (draft.item_id && output.description)
      await updateItem(actor, trackerId, draft.item_id, { description: output.description });
  } else if (draft.action === "friendly_rewrite" && draft.item_id && output.text) {
    await updateItem(actor, trackerId, draft.item_id, { description: output.text });
  } else if (draft.action === "portfolio_blurb" && draft.item_id && output.text) {
    await updateItem(actor, trackerId, draft.item_id, { portfolio_blurb: output.text });
  }
  const { error } = await db()
    .from("tracker_ai_drafts")
    .update({ status: "approved", approved_by: authorOf(actor), approved_by_admin: actor.role === "admin", approved_at: new Date().toISOString(), output })
    .eq("id", draftId)
    .eq("status", "pending");
  if (error) throw new TrackerError("Could not approve the draft.", 503);
  return output;
}

export async function discardDraft(actor: Actor, trackerId: string, draftId: string) {
  await ownedDraft(actor, trackerId, draftId);
  await db().from("tracker_ai_drafts").update({ status: "discarded" }).eq("id", draftId);
}
