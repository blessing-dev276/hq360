import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";
import { toCsv } from "@/lib/scout/csv";

const bodySchema = z.object({
  prospectIds: z.array(z.string().uuid()).min(1).max(5000),
});

const COLUMNS = [
  { key: "authorName", header: "Author name" },
  { key: "bookTitle", header: "Book title" },
  { key: "genre", header: "Genre" },
  { key: "publicationDate", header: "Publication date" },
  { key: "googleBooksReviews", header: "Google Books reviews" },
  { key: "openLibraryReviews", header: "Open Library reviews" },
  { key: "goodreadsReviews", header: "Goodreads reviews" },
  { key: "amazonReviews", header: "Amazon reviews" },
  { key: "authorWebsite", header: "Author website" },
  { key: "contactEmail", header: "Public professional email" },
  { key: "contactForm", header: "Contact form" },
  { key: "bookUrl", header: "Book URL" },
  { key: "sourceUrls", header: "Source URLs" },
  { key: "researchNotes", header: "Research notes" },
  { key: "outreachStatus", header: "Outreach status" },
  { key: "lastVerifiedAt", header: "Last verification date" },
];

function reviewsFor(
  counts: { platform: string; review_count: number | null; verified: boolean }[],
  platform: string,
) {
  const match = counts.find((c) => c.platform === platform);
  if (!match || match.review_count === null || !match.verified) return "";
  return String(match.review_count);
}

export const Route = createFileRoute("/api/admin/scout-export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
          });
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "invalid" }), { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const { data, error } = await db
            .from("scout_prospects")
            .select(
              "*, scout_authors(*), scout_discovered_books(*, scout_review_counts(platform, review_count, verified))",
            )
            .in("id", body.prospectIds);
          if (error)
            return new Response(JSON.stringify({ ok: false, error: "storage" }), { status: 500 });

          type Row = {
            status: string;
            research_notes: string | null;
            last_verified_at: string | null;
            scout_authors: {
              name: string;
              website_url: string | null;
              contact_email: string | null;
              contact_form_url: string | null;
            } | null;
            scout_discovered_books: {
              title: string;
              genre: string | null;
              publication_date: string | null;
              source_url: string | null;
              scout_review_counts: {
                platform: string;
                review_count: number | null;
                verified: boolean;
              }[];
            } | null;
          };

          const rows = ((data ?? []) as unknown as Row[]).map((row) => {
            const counts = row.scout_discovered_books?.scout_review_counts ?? [];
            return {
              authorName: row.scout_authors?.name ?? "",
              bookTitle: row.scout_discovered_books?.title ?? "",
              genre: row.scout_discovered_books?.genre ?? "",
              publicationDate: row.scout_discovered_books?.publication_date ?? "",
              googleBooksReviews: reviewsFor(counts, "google_books"),
              openLibraryReviews: reviewsFor(counts, "open_library"),
              goodreadsReviews: reviewsFor(counts, "goodreads"),
              amazonReviews: reviewsFor(counts, "amazon"),
              authorWebsite: row.scout_authors?.website_url ?? "",
              contactEmail: row.scout_authors?.contact_email ?? "",
              contactForm: row.scout_authors?.contact_form_url ?? "",
              bookUrl: row.scout_discovered_books?.source_url ?? "",
              sourceUrls: row.scout_discovered_books?.source_url ?? "",
              researchNotes: row.research_notes ?? "",
              outreachStatus: row.status,
              lastVerifiedAt: row.last_verified_at ?? "",
            };
          });

          const csv = toCsv(rows, COLUMNS);
          return new Response(csv, {
            status: 200,
            headers: {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition": `attachment; filename="scout-prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
          });
        } catch (err) {
          console.error("[admin/scout-export] POST", err instanceof Error ? err.message : err);
          return new Response(JSON.stringify({ ok: false, error: "unavailable" }), { status: 503 });
        }
      },
    },
  },
});
