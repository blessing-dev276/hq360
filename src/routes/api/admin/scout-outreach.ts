import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { asScoutDb } from "@/lib/scout/db";
import { resolveScoutAccess, canFindContacts, canSeeAuthor } from "@/lib/scout/owner.server";
import { keyForSearch } from "@/lib/perplexity/credentials.server";
import { PerplexityError } from "@/lib/perplexity/agent.server";
import {
  DEFAULT_OUTREACH_PROMPT,
  draftSchema,
  personalizeAuthorMessage,
} from "@/lib/scout/outreach.server";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function outreachHandler(request: Request) {
  const access = await resolveScoutAccess(request);
  if (!access) return json({ message: "Unauthorized" }, 401);
  if (!(await canFindContacts(access))) return json({ message: "Scouting access required." }, 403);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ message: "Invalid origin." }, 403);
  const db = supabaseAdmin as SupabaseClient;
  try {
    if (request.method === "GET") {
      const { data, error } = await db
        .from("scout_outreach_settings")
        .select("prompt")
        .eq("owner", access.owner)
        .maybeSingle();
      if (error) throw error;
      return json({ prompt: data?.prompt || DEFAULT_OUTREACH_PROMPT });
    }
    const body = z
      .discriminatedUnion("action", [
        z
          .object({ action: z.literal("save_prompt"), prompt: z.string().trim().min(1).max(6000) })
          .strict(),
        z
          .object({
            action: z.enum(["draft", "load"]),
            authorId: z.string().uuid(),
            bookId: z.string().uuid(),
            recipient: z.string().email(),
          })
          .strict(),
        z
          .object({ action: z.literal("save_draft"), id: z.string().uuid(), ...draftSchema.shape })
          .strict(),
      ])
      .parse(await request.json());
    if (body.action === "save_prompt") {
      const { error } = await db
        .from("scout_outreach_settings")
        .upsert({ owner: access.owner, prompt: body.prompt, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === "save_draft") {
      const { data: existing, error: readError } = await db
        .from("scout_author_message_drafts")
        .select("author_id")
        .eq("id", body.id)
        .eq("owner", access.owner)
        .maybeSingle();
      if (readError) throw readError;
      if (
        !existing ||
        !(await canSeeAuthor(asScoutDb(supabaseAdmin), access.owner, existing.author_id))
      )
        return json({ message: "Draft not found." }, 404);
      const { data, error } = await db
        .from("scout_author_message_drafts")
        .update({ subject: body.subject, body: body.body })
        .eq("id", body.id)
        .eq("owner", access.owner)
        .select("id,recipient,subject,body")
        .single();
      if (error) throw error;
      return json({ draft: data });
    }
    if (!(await canSeeAuthor(asScoutDb(supabaseAdmin), access.owner, body.authorId)))
      return json({ message: "Author not found." }, 404);
    const [authorResult, bookResult, settings] = await Promise.all([
      db
        .from("scout_authors")
        .select("name,bio,contact_email,contact_emails")
        .eq("id", body.authorId)
        .single(),
      db
        .from("scout_discovered_books")
        .select("title,description")
        .eq("id", body.bookId)
        .eq("scout_author_id", body.authorId)
        .single(),
      db.from("scout_outreach_settings").select("prompt").eq("owner", access.owner).maybeSingle(),
    ]);
    if (authorResult.error || bookResult.error || settings.error)
      return json({ message: "Could not load author and book details." }, 404);
    const author = authorResult.data;
    const recipient = body.recipient.toLowerCase();
    if (
      ![author.contact_email, ...(author.contact_emails ?? [])].some(
        (e: string | null) => e?.toLowerCase() === recipient,
      )
    )
      return json({ message: "Choose a saved author contact." }, 400);
    if (body.action === "load") {
      const { data, error } = await db
        .from("scout_author_message_drafts")
        .select("id,recipient,subject,body")
        .eq("owner", access.owner)
        .eq("author_id", body.authorId)
        .eq("book_id", body.bookId)
        .eq("recipient", recipient)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return json({ draft: data });
    }
    const apiKey = await keyForSearch(access);
    const draft = await personalizeAuthorMessage(
      {
        author: author.name,
        bio: author.bio,
        title: bookResult.data.title,
        description: bookResult.data.description,
      },
      settings.data?.prompt || DEFAULT_OUTREACH_PROMPT,
      apiKey,
    );
    const { data, error } = await db
      .from("scout_author_message_drafts")
      .insert({
        owner: access.owner,
        author_id: body.authorId,
        book_id: body.bookId,
        recipient,
        ...draft,
      })
      .select("id,recipient,subject,body")
      .single();
    if (error) throw error;
    return json({ draft: data });
  } catch (error) {
    if (error instanceof PerplexityError) return json({ message: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ message: "Invalid message request." }, 400);
    return json({ message: "Message settings are unavailable. Please retry." }, 503);
  }
}
export const Route = createFileRoute("/api/admin/scout-outreach")({
  server: {
    handlers: {
      GET: ({ request }) => outreachHandler(request),
      POST: ({ request }) => outreachHandler(request),
    },
  },
});
