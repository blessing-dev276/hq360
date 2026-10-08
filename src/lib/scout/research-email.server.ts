import { randomUUID } from "node:crypto";
import { asScoutDb } from "./db";
import { canSeeAuthor, type ScoutAccess } from "./owner.server";
import { PerplexityError, runAgent } from "@/lib/perplexity/agent.server";
import { keyForSearch } from "@/lib/perplexity/credentials.server";
import { findAuthorContacts, type AuthorContactResult } from "./perplexity-contact.server";
import { freeContactEvidence, websiteContactEvidence } from "./website-contact.server";
import {
  emailDb,
  createEmailRun,
  checkEmailRun,
  loadStageCache,
  saveStageCache,
  reserveEmailPass,
  settleEmailPass,
  recordEmailResult,
} from "./email-budget.server";

export async function researchAuthorEmail(
  access: ScoutAccess,
  authorId: string,
  body: { bookId?: string | undefined; retry?: boolean | undefined; runId?: string | undefined },
) {
  const db = emailDb();
  if (!(await canSeeAuthor(asScoutDb(db), access.owner, authorId)))
    throw new PerplexityError("Author not found.", 404);
  const { data: author, error: authorError } = await db
    .from("scout_authors")
    .select("*")
    .eq("id", authorId)
    .single();
  if (authorError) throw new PerplexityError("Could not load author.", 503);
  let bookQuery = db
    .from("scout_discovered_books")
    .select("id,title")
    .eq("scout_author_id", authorId);
  if (body.bookId) bookQuery = bookQuery.eq("id", body.bookId);
  const { data: books, error: bookError } = await bookQuery
    .order("created_at", { ascending: false })
    .limit(1);
  const book = books?.[0];
  if (bookError || !book)
    throw new PerplexityError("Save a book for this author before finding contacts.", 400);
  const run = body.runId
    ? await checkEmailRun(body.runId, access.owner, authorId, book.id)
    : await createEmailRun(access.owner, [{ authorId, bookId: book.id }]);
  const token = randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("claim_scout_email_author", {
    p_author: authorId,
    p_token: token,
  });
  if (claimError) throw new PerplexityError("Could not lock search. Please retry.", 503);
  if (!claimed)
    throw new PerplexityError("This author is already being researched. Try again shortly.", 409);
  try {
    const contacts: AuthorContactResult["contacts"] = author.contact_evidence ?? [];
    if (
      author.contact_search_status &&
      (!body.retry || contacts.some((c) => c.role === "author" && c.verified))
    ) {
      await recordEmailResult(run.id, authorId, "cached", contacts, 0);
      return {
        ok: true,
        runId: run.id,
        status: author.contact_search_status,
        emails: author.contact_emails ?? [],
        contacts,
        cached: true,
      };
    }
    const cache = await loadStageCache(authorId);
    const input = { author: author.name, book: book.title, website: author.website_url };
    let free = cache.get(-1);
    if (!free) {
      free = await freeContactEvidence(input);
      await saveStageCache(authorId, -1, free);
    }
    let result = free;
    if (!free.contacts.some((c) => c.role === "author" && c.verified)) {
      let ticket = "";
      let apiKey = "";
      result = await findAuthorContacts(
        input,
        async (request) => {
          const response = await runAgent(request, fetch, { apiKey });
          await settleEmailPass(ticket, response.costUsd);
          return response;
        },
        fetch,
        {
          cache,
          beforeStage: async (stage) => {
            apiKey ||= await keyForSearch(access);
            ticket = await reserveEmailPass(run.id, access.owner, authorId, stage);
          },
          onStage: async (stage, value) => saveStageCache(authorId, stage, value),
          checkWebsite: (website) => websiteContactEvidence({ ...input, website }),
        },
      );
      const merged = new Map(free.contacts.map((c) => [c.email, c]));
      for (const c of result.contacts)
        if (!merged.get(c.email)?.verified || c.verified) merged.set(c.email, c);
      result.contacts = [...merged.values()];
      result.sources = [...free.sources, ...result.sources];
    }
    const sorted = [...result.contacts].sort(
      (a, b) =>
        Number(b.role === "author" && b.verified) - Number(a.role === "author" && a.verified),
    );
    const emails = [...new Set(sorted.map((c) => c.email.toLowerCase()))];
    const status = result.complete === false ? "paused" : emails.length ? "found" : "not_found";
    await recordEmailResult(
      run.id,
      authorId,
      status,
      sorted,
      new Set(result.sources.map((s) => s.url)).size,
    );
    // Do not cache a stopped pass as a completed no-result search.
    const { error } = await db
      .from("scout_authors")
      .update({
        contact_emails: emails,
        contact_evidence: sorted,
        contact_search_status: status === "paused" ? null : status,
        contact_searched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", authorId);
    if (error) throw new PerplexityError("Could not save search results.", 503);
    const direct = sorted.find((c) => c.role === "author" && c.verified);
    if (direct)
      await db
        .from("scout_authors")
        .update({ contact_email: direct.email, contact_verification_status: "unverified" })
        .eq("id", authorId)
        .neq("contact_verification_status", "verified");
    return {
      ok: true,
      runId: run.id,
      status,
      emails,
      contacts: sorted,
      checkedSources: new Set(result.sources.map((s) => s.url)).size,
      message: result.stopReason === "budget" ? result.summary : undefined,
    };
  } finally {
    await db.from("scout_email_locks").delete().eq("author_id", authorId).eq("token", token);
  }
}
