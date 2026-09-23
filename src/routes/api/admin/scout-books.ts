import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PAGE_SIZE = 25;

export const Route = createFileRoute("/api/admin/scout-books")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const url = new URL(request.url);
          const page = Math.max(0, Number(url.searchParams.get("page") ?? "0") || 0);
          const genre = url.searchParams.get("genre") ?? undefined;
          const source = url.searchParams.get("source") ?? undefined;
          const format = url.searchParams.get("format") ?? undefined;
          const publishedFrom = url.searchParams.get("publishedFrom") ?? undefined;
          const publishedTo = url.searchParams.get("publishedTo") ?? undefined;
          const platform = url.searchParams.get("platform") ?? undefined;
          const reviewMin = url.searchParams.get("reviewMin");
          const reviewMax = url.searchParams.get("reviewMax");
          const country = url.searchParams.get("country") ?? undefined;
          const publishingType = url.searchParams.get("publishingType") ?? undefined;
          const contactAvailable = url.searchParams.get("contactAvailable");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          let query = db
            .from("scout_discovered_books")
            .select(
              "*, scout_authors(id, name, country, publishing_type, website_url, contact_email, contact_form_url), scout_review_counts(platform, review_count, rating, verified, retrieved_at), scout_prospects(id, status), scout_batches!batch_id(id, label, created_at)",
              { count: "exact" },
            )
            .order("discovered_at", { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

          if (genre) query = query.ilike("genre", `%${genre}%`);
          if (source) query = query.eq("source_slug", source);
          if (format) query = query.eq("book_format", format);
          if (publishedFrom) query = query.gte("publication_date", publishedFrom);
          if (publishedTo) query = query.lte("publication_date", publishedTo);

          const { data, error, count } = await query;
          if (error) return json({ ok: false, error: "storage" }, 500);

          // Review-count range, author country/publishing-type/contact and
          // prospect status filters cut across joined rows, which
          // PostgREST can't express cleanly in a single filtered query, so
          // they're applied in-process against the page just fetched.
          let items = (data ?? []) as Array<Record<string, unknown>>;
          if (platform && (reviewMin || reviewMax)) {
            const min = reviewMin ? Number(reviewMin) : -Infinity;
            const max = reviewMax ? Number(reviewMax) : Infinity;
            items = items.filter((row) => {
              const counts =
                (row.scout_review_counts as { platform: string; review_count: number | null }[]) ??
                [];
              const match = counts.find((c) => c.platform === platform);
              if (!match || match.review_count === null) return false;
              return match.review_count >= min && match.review_count <= max;
            });
          }
          if (country) {
            items = items.filter(
              (row) =>
                (row.scout_authors as { country: string | null } | null)?.country === country,
            );
          }
          if (publishingType) {
            items = items.filter(
              (row) =>
                (row.scout_authors as { publishing_type: string | null } | null)
                  ?.publishing_type === publishingType,
            );
          }
          if (contactAvailable !== null && contactAvailable !== undefined) {
            const want = contactAvailable === "true";
            items = items.filter((row) => {
              const author = row.scout_authors as {
                contact_email: string | null;
                contact_form_url: string | null;
              } | null;
              const has = Boolean(author?.contact_email || author?.contact_form_url);
              return has === want;
            });
          }

          return json({ ok: true, items, total: count ?? items.length, page, pageSize: PAGE_SIZE });
        } catch (err) {
          console.error("[admin/scout-books] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
