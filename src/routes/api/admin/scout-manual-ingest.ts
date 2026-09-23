import { canonicalUrl } from "@/lib/scout/normalize";
import { amazonProduct } from "@/lib/scout/amazon-url";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, normalizedName, type ScoutAuthor, type ScoutBook } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Manual, staff-supplied ingestion: one specific page a staff member is
 * already looking at (an Amazon book page, an independent publisher's
 * catalog entry, etc.), with fields they read off that page by hand.
 * Nothing here fetches or parses the source page automatically -- this is
 * the reusable alternative for any source without a safe automated path,
 * not a scraper with a form bolted on front.
 */
const bodySchema = z.object({
  sourceSlug: z.string().trim().min(1).max(80),
  sourceUrl: z.string().trim().min(1).max(2000),
  authorName: z.string().trim().min(1).max(160),
  bookTitle: z.string().trim().min(1).max(300),
  country: z.string().trim().max(80).optional(),
  genre: z.string().trim().max(80).optional(),
  description: z.string().trim().max(4000).optional(),
  publicationDate: z.string().trim().max(40).optional(),
  authorProfileUrl: z.string().trim().max(2000).optional(),
  bookUrl: z.string().trim().max(2000).optional(),
  authorWebsiteUrl: z.string().trim().max(2000).optional(),
  amazonReviewCount: z.number().int().min(1).max(49).optional(),
  // Non-Amazon sources don't share Amazon's "rating count" semantics (e.g.
  // Reedsy Discovery's editorial verdict is a 1-5 score, not a count), so
  // they use this generic pair instead of amazonReviewCount.
  reviewPlatform: z.string().trim().min(1).max(40).optional(),
  reviewCount: z.number().int().min(0).max(999).optional(),
  // Pass the same batchId + batchLabel for every book ingested in one
  // search run so they group as a single "batch" the UI can list and
  // export together, instead of each book creating its own throwaway
  // batch of one.
  batchId: z.string().uuid().optional(),
  batchLabel: z.string().trim().min(1).max(200).optional(),
  // Staff must explicitly say "yes, this website belongs to this author" --
  // a name/URL pairing found on a listing page is not itself proof of
  // identity, so an unconfirmed website is recorded as a lead to verify,
  // never written into the author's verified contact fields.
  identityConfirmed: z.boolean().optional(),
});

function normalizedTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function transientDatabaseError(error: unknown) {
  const value = error as { status?: number; message?: string } | null;
  const message = value?.message?.toLowerCase() ?? "";
  return (
    value?.status === 522 ||
    message.includes("522") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("connection")
  );
}

async function withDatabaseRetry<T>(operation: () => PromiseLike<T>): Promise<T> {
  let result: T;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      result = await operation();
    } catch (error) {
      if (!transientDatabaseError(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    const error = (result as { error?: unknown } | null)?.error;
    if (!error) return result;
    if (!transientDatabaseError(error) || attempt === 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error("Database retry exhausted");
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_ONLY = /^\d{4}$/;

function parseManualDate(value: string): { date: string | null; year: number | null } | null {
  if (FULL_DATE.test(value)) return { date: value, year: Number(value.slice(0, 4)) };
  if (YEAR_ONLY.test(value)) return { date: null, year: Number(value) };
  return null;
}

export const Route = createFileRoute("/api/admin/scout-manual-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        let sourceUrl = canonicalUrl(body.sourceUrl);
        let asin: string | null = null;
        if (body.sourceSlug === "amazon_books") {
          try {
            const product = amazonProduct(body.sourceUrl);
            sourceUrl = product.url;
            asin = product.asin;
            if (body.amazonReviewCount === undefined)
              throw new Error("Enter the Amazon rating count from the book page.");
          } catch (error) {
            return json(
              { ok: false, error: "invalid_amazon_book", message: (error as Error).message },
              400,
            );
          }
        }
        if (!sourceUrl) return json({ ok: false, error: "invalid_source_url" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { data: source } = await withDatabaseRetry(() =>
            db.from("scout_sources").select("slug, kind").eq("slug", body.sourceSlug).maybeSingle(),
          );
          if (!source) return json({ ok: false, error: "unknown_source" }, 400);
          // Automated (kind: 'api') sources go through discovery, not this
          // form -- manual ingest is only for sources without a safe
          // automated path.
          if ((source as { kind: string }).kind === "api")
            return json({ ok: false, error: "source_is_automated" }, 400);

          const profileUrl = canonicalUrl(body.authorProfileUrl);
          const authorNorm = normalizedName(body.authorName);
          let { data: author } = await withDatabaseRetry(() =>
            db
              .from("scout_authors")
              .select("*")
              .eq("source_slug", body.sourceSlug)
              .eq(profileUrl ? "author_profile_url" : "source_url", profileUrl ?? sourceUrl)
              .is("merged_into", null)
              .maybeSingle(),
          );
          if (!author) {
            const authorId = crypto.randomUUID();
            const { data: created, error: authorErr } = await withDatabaseRetry(() =>
              db
                .from("scout_authors")
                .upsert({
                  id: authorId,
                  name: body.authorName,
                  normalized_name: authorNorm,
                  source_slug: body.sourceSlug,
                  source_url: sourceUrl,
                  author_profile_url: profileUrl,
                  country: body.country ?? null,
                })
                .select("*")
                .single(),
            );
            if (authorErr || !created) return json({ ok: false, error: "storage" }, 500);
            author = created;
          }
          const authorRow = author as ScoutAuthor;

          let authorForResponse = authorRow;
          if (body.authorWebsiteUrl) {
            if (body.identityConfirmed && !authorRow.website_url) {
              const { data: updatedAuthor } = await db
                .from("scout_authors")
                .update({
                  website_url: body.authorWebsiteUrl,
                  website_verification_status: "verified",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", authorRow.id)
                .select("*")
                .single();
              if (updatedAuthor) authorForResponse = updatedAuthor as ScoutAuthor;
            } else if (!body.identityConfirmed) {
              await db.from("scout_research_notes").insert({
                scout_author_id: authorRow.id,
                note: `Candidate website from manual ingest (identity not confirmed by staff): ${body.authorWebsiteUrl}`,
                source_url: sourceUrl,
                verification_status: "unverified",
                retrieved_at: new Date().toISOString(),
                added_by: "scout_manual_ingest",
              });
            }
          }

          const titleNorm = normalizedTitle(body.bookTitle);
          let { data: book } = await withDatabaseRetry(() =>
            db
              .from("scout_discovered_books")
              .select("*")
              .eq("scout_author_id", authorRow.id)
              .eq("normalized_title", titleNorm)
              .maybeSingle(),
          );

          const publicationDate = body.publicationDate?.trim();
          const parsedDate = publicationDate ? parseManualDate(publicationDate) : null;

          const newBatchId = body.batchId ?? crypto.randomUUID();
          const { data: existingBatch } = body.batchId
            ? await withDatabaseRetry(() =>
                db.from("scout_batches").select("*").eq("id", newBatchId).maybeSingle(),
              )
            : { data: null };
          const existingItemCount =
            (existingBatch as { item_count: number } | null)?.item_count ?? 0;
          const { data: batch, error: batchErr } = await withDatabaseRetry(() =>
            db
              .from("scout_batches")
              .upsert({
                id: newBatchId,
                label:
                  (existingBatch as { label: string } | null)?.label ??
                  body.batchLabel ??
                  `Manual: ${source.slug} — "${body.bookTitle}"`,
                genre: body.genre ?? null,
                query: null,
                sources: [body.sourceSlug],
                requested_max: 1,
                total_available: null,
                item_count: existingItemCount + (book ? 0 : 1),
              })
              .select("*")
              .single(),
          );
          if (batchErr || !batch) return json({ ok: false, error: "storage" }, 500);
          const batchId = (batch as { id: string }).id;

          if (!book) {
            const bookId = crypto.randomUUID();
            const { data: created, error: bookErr } = await withDatabaseRetry(() =>
              db
                .from("scout_discovered_books")
                .upsert({
                  id: bookId,
                  scout_author_id: authorRow.id,
                  title: body.bookTitle,
                  normalized_title: titleNorm,
                  genre: body.genre ?? null,
                  publication_date: parsedDate?.date ?? null,
                  publication_year: parsedDate?.year ?? null,
                  book_format: "unknown",
                  source_slug: body.sourceSlug,
                  source_url: sourceUrl,
                  asin,
                  description: body.description ?? null,
                  ingest_method: "manual",
                  raw_data: {
                    manual: true,
                    authorProfileUrl: body.authorProfileUrl ?? null,
                    bookUrl: body.bookUrl ?? null,
                  },
                  batch_id: batchId,
                })
                .select("*")
                .single(),
            );
            if (bookErr || !created) return json({ ok: false, error: "storage" }, 500);
            book = created;
          }

          const { error: membershipError } = await withDatabaseRetry(() =>
            db.from("scout_batch_books").upsert({ batch_id: batchId, book_id: book.id }),
          );
          if (membershipError) throw membershipError;

          if (body.sourceSlug === "amazon_books" && body.amazonReviewCount !== undefined) {
            const { error: reviewError } = await withDatabaseRetry(() =>
              db.from("scout_review_counts").upsert(
                {
                  book_id: book.id,
                  platform: "amazon",
                  review_count: body.amazonReviewCount,
                  verified: true,
                  source_url: sourceUrl,
                  retrieved_at: new Date().toISOString(),
                },
                { onConflict: "book_id,platform" },
              ),
            );
            if (reviewError) throw reviewError;
          }
          if (body.reviewPlatform && body.reviewCount !== undefined) {
            const { error: reviewError } = await withDatabaseRetry(() =>
              db.from("scout_review_counts").upsert(
                {
                  book_id: book.id,
                  platform: body.reviewPlatform,
                  review_count: body.reviewCount,
                  verified: true,
                  source_url: sourceUrl,
                  retrieved_at: new Date().toISOString(),
                },
                { onConflict: "book_id,platform" },
              ),
            );
            if (reviewError) throw reviewError;
          }
          return json({
            ok: true,
            item: { author: authorForResponse, book: book as ScoutBook },
            batchId,
          });
        } catch (err) {
          console.error(
            "[admin/scout-manual-ingest] POST",
            err instanceof Error ? err.message : err,
          );
          return json(
            {
              ok: false,
              error: "unavailable",
              message: transientDatabaseError(err)
                ? "The database is temporarily unavailable. Please wait a moment and try again."
                : "The book could not be saved. Please try again.",
            },
            503,
          );
        }
      },
    },
  },
});
