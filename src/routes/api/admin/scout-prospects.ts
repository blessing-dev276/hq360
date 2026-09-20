import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, type ScoutProspect } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const createSchema = z.object({
  scoutAuthorId: z.string().uuid(),
  bookId: z.string().uuid().nullable().optional(),
});

export const Route = createFileRoute("/api/admin/scout-prospects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const url = new URL(request.url);
          const status = url.searchParams.get("status") ?? undefined;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          let query = db
            .from("scout_prospects")
            .select(
              "*, scout_authors(*), scout_discovered_books(*, scout_review_counts(platform, review_count, rating, verified))",
            )
            .order("created_at", { ascending: false });
          if (status) query = query.eq("status", status);
          const { data, error } = await query;
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: data ?? [] });
        } catch (err) {
          console.error("[admin/scout-prospects] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof createSchema>;
        try {
          body = createSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          // A prospect already marked excluded or do-not-contact for this
          // author must not be silently resurrected by a fresh save from
          // discovery -- surface it instead of inserting a duplicate.
          let dupeQuery = db
            .from("scout_prospects")
            .select("*")
            .eq("scout_author_id", body.scoutAuthorId);
          dupeQuery = body.bookId
            ? dupeQuery.eq("book_id", body.bookId)
            : dupeQuery.is("book_id", null);
          const { data: existingForAuthor } = await dupeQuery.maybeSingle();
          if (existingForAuthor) {
            const existing = existingForAuthor as ScoutProspect;
            if (existing.do_not_contact || existing.status === "excluded") {
              return json({ ok: false, error: "author_excluded", item: existing }, 409);
            }
            return json({ ok: true, item: existing, duplicate: true });
          }

          const { data: created, error } = await db
            .from("scout_prospects")
            .insert({
              scout_author_id: body.scoutAuthorId,
              book_id: body.bookId ?? null,
              status: "new",
            })
            .select("*")
            .single();
          if (error || !created) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: created }, 201);
        } catch (err) {
          console.error("[admin/scout-prospects] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
