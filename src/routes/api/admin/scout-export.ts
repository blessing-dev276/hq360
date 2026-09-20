import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";
import { toCsv, SCOUT_EXPORT_COLUMNS, buildScoutExportRow } from "@/lib/scout/csv";

const bodySchema = z.object({
  prospectIds: z.array(z.string().uuid()).min(1).max(5000),
});

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

          const rows = ((data ?? []) as unknown as Row[]).map((row) =>
            buildScoutExportRow({
              authorName: row.scout_authors?.name ?? "",
              bookTitle: row.scout_discovered_books?.title ?? "",
              genre: row.scout_discovered_books?.genre ?? null,
              publicationDate: row.scout_discovered_books?.publication_date ?? null,
              reviewCounts: row.scout_discovered_books?.scout_review_counts ?? [],
              authorWebsite: row.scout_authors?.website_url ?? null,
              contactEmail: row.scout_authors?.contact_email ?? null,
              contactForm: row.scout_authors?.contact_form_url ?? null,
              bookUrl: row.scout_discovered_books?.source_url ?? null,
              researchNotes: row.research_notes ?? null,
              outreachStatus: row.status,
              lastVerifiedAt: row.last_verified_at ?? null,
            }),
          );

          const csv = toCsv(rows, SCOUT_EXPORT_COLUMNS);
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
