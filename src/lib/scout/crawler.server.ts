import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { asScoutDb, type ScoutSource, type ScoutAuthor, type ScoutBook } from "./db";
import { SOURCE_ADAPTERS, type DiscoveryQuery } from "./adapters";
import { createTransport, AccessError } from "./transport.server";
import {
  normalizeBook,
  compareIdentity,
  qualification,
  titleSimilarity,
  type NormalizedBook,
} from "./normalize";
const db = () => asScoutDb(supabaseAdmin);
function check(error: unknown) {
  if (error) throw error;
}
export async function crawlSource(
  slug: string,
  query?: DiscoveryQuery,
  scheduled = false,
  batchId?: string,
) {
  const adapter = SOURCE_ADAPTERS[slug];
  if (!adapter) throw new Error("Source has no approved automated adapter");
  const { data: token, error: claimError } = await db().rpc("scout_claim_source", {
    p_slug: slug,
    p_scheduled: scheduled,
  });
  check(claimError);
  if (!token)
    return {
      slug,
      skipped: true,
      reason: "Disabled, restricted, not due, or another crawl is running",
      items: [],
      count: 0,
    };
  let source: ScoutSource | undefined, runId: string | undefined;
  const errors: { message: string; url: string; at: string }[] = [];
  const items: { author: ScoutAuthor; book: ScoutBook }[] = [];
  let booksAdded = 0,
    authorsAdded = 0,
    discovered = 0,
    pages = 0;
  let status = "completed";
  let accessStatus: string | undefined;
  async function log(message: string, url = "") {
    errors.push({ message, url, at: new Date().toISOString() });
    console.error("[scout/crawl]", slug, message, url);
    if (runId) {
      const { error } = await db().from("scout_crawl_runs").update({ errors }).eq("id", runId);
      check(error);
    }
  }
  try {
    const { data, error } = await db().from("scout_sources").select("*").eq("slug", slug).single();
    check(error);
    source = data as ScoutSource;
    const term = query ?? {
      query: String(source.config.query ?? ""),
      genre: typeof source.config.genre === "string" ? source.config.genre : undefined,
    };
    if (!term.query.trim() && !term.genre?.trim())
      throw new Error("Set a query or genre before crawling");
    if (!batchId) {
      const { data: batch, error } = await db()
        .from("scout_batches")
        .insert({
          label: `${source.name}: ${term.query || term.genre}`,
          sources: [slug],
          query: term.query,
          genre: term.genre ?? null,
        })
        .select("id")
        .single();
      check(error);
      if (!batch) throw new Error("Batch insert failed");
      batchId = batch.id;
    }
    const { data: run, error: runError } = await db()
      .from("scout_crawl_runs")
      .insert({ source_slug: slug, batch_id: batchId })
      .select("id")
      .single();
    check(runError);
    if (!run) throw new Error("Run insert failed");
    runId = run.id;
    const deadline = Date.now() + 90000;
    const transport = createTransport(source, deadline, log);
    const max = Math.min(
      source.max_records,
      query?.maxResults ?? source.max_records,
      Math.max(0, (source.collection_limit_per_day ?? 200) - source.daily_records),
    );
    const seen = new Set<string>();
    try {
      for (let page = 0; page < source.max_pages && discovered < max; page++) {
        const pageSize = Math.min(40, max - discovered);
        const candidates = await adapter.discover({
          ...term,
          maxResults: pageSize,
          offset: page * 40,
          fetchJson: transport.fetchJson,
        });
        if (!candidates.length) break;
        let fresh = 0;
        for (const candidate of candidates.slice(0, max - discovered)) {
          if (Date.now() > deadline) throw new Error("Crawl time budget reached");
          const normalized = normalizeBook(slug, candidate);
          if (seen.has(normalized.source_url)) continue;
          seen.add(normalized.source_url);
          fresh++;
          discovered++;
          const { data: saved, error } = await db().rpc("scout_save_book", {
            p_book: normalized,
            p_batch: batchId,
            p_token: token,
          });
          check(error);
          const row = saved as unknown as {
            author: ScoutAuthor;
            book: ScoutBook;
            authorAdded: boolean;
            bookAdded: boolean;
          };
          booksAdded += Number(row.bookAdded);
          authorsAdded += Number(row.authorAdded);
          items.push({ author: row.author, book: row.book });
          if (row.authorAdded) await queueIdentityReview(row.author, normalized);
          await qualifyAuthor(row.author);
        }
        if (!fresh) break;
      }
    } finally {
      pages = transport.pages;
    }
  } catch (error) {
    status = error instanceof AccessError ? "blocked" : "failed";
    if (error instanceof AccessError) accessStatus = error.status;
    await log(error instanceof Error ? error.message : String(error));
  } finally {
    if (runId) {
      const { error } = await db()
        .from("scout_crawl_runs")
        .update({
          status,
          completed_at: new Date().toISOString(),
          pages,
          records: discovered,
          books_added: booksAdded,
          authors_added: authorsAdded,
          errors,
        })
        .eq("id", runId);
      check(error);
    }
    if (source) {
      const interval =
        source.sync_schedule === "daily"
          ? 86400000
          : source.sync_schedule === "weekly"
            ? 7 * 86400000
            : null;
      const { error } = await db()
        .from("scout_sources")
        .update({
          last_synced_at: new Date().toISOString(),
          last_error: errors.at(-1)?.message ?? null,
          error_count: source.error_count + errors.length,

          next_crawl_at: interval
            ? new Date(new Date().setUTCHours(0, 0, 0, 0) + interval).toISOString()
            : null,
          ...(accessStatus ? { source_access_status: accessStatus } : {}),
          crawl_token: null,
          crawl_lease_until: null,
        })
        .eq("slug", slug)
        .eq("crawl_token", token);
      check(error);
    } else {
      const { error } = await db()
        .from("scout_sources")
        .update({ crawl_token: null, crawl_lease_until: null })
        .eq("slug", slug)
        .eq("crawl_token", token);
      check(error);
    }
    if (batchId) {
      const { error } = await db()
        .from("scout_batches")
        .update({ item_count: new Set(items.map((i) => i.book.id)).size })
        .eq("id", batchId);
      check(error);
    }
  }
  return {
    slug,
    runId,
    batchId,
    status,
    errors,
    items,
    count: items.length,
    booksAdded,
    authorsAdded,
  };
}
async function queueIdentityReview(author: ScoutAuthor, book: NormalizedBook) {
  const { data: others, error } = await db()
    .from("scout_authors")
    .select("*")
    .eq("normalized_name", author.normalized_name)
    .neq("id", author.id)
    .is("merged_into", null)
    .limit(100);
  check(error);
  for (const other of (others ?? []) as ScoutAuthor[]) {
    const { data: books, error } = await db()
      .from("scout_discovered_books")
      .select("isbn,title,publisher")
      .eq("scout_author_id", other.id);
    check(error);
    const match = compareIdentity(
      {
        name: author.name,
        website: author.website_url,
        books: book.isbn ? [book.isbn] : [],
        publisher: book.publisher,
        bio: author.bio,
        socialLinks: author.social_links,
      },
      {
        name: other.name,
        website: other.website_url,
        books: (books ?? []).map((b) => b.isbn).filter(Boolean),
        publisher: books?.[0]?.publisher,
        bio: other.bio,
        socialLinks: other.social_links,
      },
    );
    const fuzzy = (books ?? []).some((b) => titleSimilarity(b.title, book.book_title) >= 0.8);
    const { error: reviewError } = await db()
      .from("scout_identity_reviews")
      .upsert(
        {
          author_id: author.id,
          candidate_id: other.id,
          confidence_score: match.score,
          evidence: { reasons: match.reasons, similar_title: fuzzy, source_url: book.source_url },
        },
        { onConflict: "author_id,candidate_id" },
      );
    check(reviewError);
  }
}
async function qualifyAuthor(author: ScoutAuthor) {
  const { data: books, error } = await db()
    .from("scout_discovered_books")
    .select("*,scout_book_sources(normalized_data)")
    .eq("scout_author_id", author.id);
  check(error);
  const normalized = (books ?? []).flatMap((b) =>
    (b.scout_book_sources ?? []).map((s: { normalized_data: NormalizedBook }) => s.normalized_data),
  );
  const q = qualification(
    [...new Map(normalized.map((b) => [b.normalized_title, b])).values()],
    author.website_url,
    author.contact_verification_status === "verified" ? author.contact_email : null,
  );
  const { error: updateError } = await db()
    .from("scout_authors")
    .update({ qualification: q })
    .eq("id", author.id);
  check(updateError);
}
export async function runScheduledCrawl() {
  // One bounded source per invocation; frequent ticks drain due sources without long requests.
  const { data, error } = await db()
    .from("scout_sources")
    .select("slug")
    .eq("enabled", true)
    .in("source_access_status", ["allowed", "limited"])
    .in("sync_schedule", ["daily", "weekly"])
    .neq("slug", "open_library")
    .or(`next_crawl_at.is.null,next_crawl_at.lte.${new Date().toISOString()}`)
    .order("next_crawl_at", { nullsFirst: true })
    .limit(1);
  check(error);
  return data?.[0]
    ? crawlSource(data[0].slug, undefined, true)
    : { skipped: true, reason: "No sources due" };
}
