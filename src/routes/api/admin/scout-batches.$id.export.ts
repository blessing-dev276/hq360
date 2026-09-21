import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";
import { toCsv, SCOUT_EXPORT_COLUMNS, buildScoutExportRow } from "@/lib/scout/csv";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/scout-batches/$id/export")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const { data, error } = await db
            .from("scout_discovered_books")
            .select(
              "*, scout_batch_books!inner(batch_id), scout_authors(*), scout_review_counts(platform, review_count, verified), scout_prospects(status, research_notes, last_verified_at)",
            )
            .eq("scout_batch_books.batch_id", params.id);
          if (error) return json({ ok: false, error: "storage" }, 500);

          type Row = {
            title: string;
            genre: string | null;
            publication_date: string | null;
            source_url: string | null;
            scout_authors: {
              name: string;
              website_url: string | null;
              contact_email: string | null;
              contact_form_url: string | null;
            } | null;
            scout_review_counts: {
              platform: string;
              review_count: number | null;
              verified: boolean;
            }[];
            scout_prospects: {
              status: string;
              research_notes: string | null;
              last_verified_at: string | null;
            }[];
          };

          const rows = ((data ?? []) as unknown as Row[]).map((row) => {
            // A book not yet saved as a prospect has no status/notes of its
            // own -- "new" and blank are the honest defaults, not a guess.
            const prospect = row.scout_prospects?.[0];
            return buildScoutExportRow({
              authorName: row.scout_authors?.name ?? "",
              bookTitle: row.title,
              genre: row.genre,
              publicationDate: row.publication_date,
              reviewCounts: row.scout_review_counts ?? [],
              authorWebsite: row.scout_authors?.website_url ?? null,
              contactEmail: row.scout_authors?.contact_email ?? null,
              contactForm: row.scout_authors?.contact_form_url ?? null,
              bookUrl: row.source_url,
              researchNotes: prospect?.research_notes ?? null,
              outreachStatus: prospect?.status ?? "new",
              lastVerifiedAt: prospect?.last_verified_at ?? null,
            });
          });

          const csv = toCsv(rows, SCOUT_EXPORT_COLUMNS);
          return new Response(csv, {
            status: 200,
            headers: {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition": `attachment; filename="scout-batch-${params.id.slice(0, 8)}.csv"`,
            },
          });
        } catch (err) {
          console.error(
            "[admin/scout-batches.$id.export] POST",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
