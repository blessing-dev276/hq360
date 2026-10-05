import { createFileRoute } from "@tanstack/react-router";
import { ownsBatch, resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb } from "@/lib/scout/db";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark every book in one of the caller's batches as scouted: each becomes a
 *  saved prospect (and so a lead) in the caller's workspace. Skips books
 *  already scouted and authors this workspace excluded or must not contact. */
export const Route = createFileRoute("/api/admin/scout-batches/$id/scout")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ ok: false, error: "Invalid origin" }, 403);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          if (!(await ownsBatch(db, access.owner, params.id)))
            return json({ ok: false, error: "not_found" }, 404);

          const { data: links } = await db
            .from("scout_batch_books")
            .select("book_id, scout_discovered_books!inner(id, scout_author_id)")
            .eq("batch_id", params.id);
          type Row = {
            scout_discovered_books:
              { id: string; scout_author_id: string } | { id: string; scout_author_id: string }[];
          };
          const books = ((links ?? []) as unknown as Row[])
            .map((l) =>
              Array.isArray(l.scout_discovered_books)
                ? l.scout_discovered_books[0]
                : l.scout_discovered_books,
            )
            .filter((b): b is { id: string; scout_author_id: string } => !!b?.scout_author_id);
          if (!books.length) return json({ ok: true, added: 0, skipped: 0 });

          const { data: existing } = await db
            .from("scout_prospects")
            .select("scout_author_id, book_id, status, do_not_contact")
            .eq("owner", access.owner)
            .in("scout_author_id", [...new Set(books.map((b) => b.scout_author_id))]);
          const rows = (existing ?? []) as {
            scout_author_id: string;
            book_id: string | null;
            status: string;
            do_not_contact: boolean;
          }[];
          const blocked = new Set(
            rows
              .filter((r) => r.do_not_contact || r.status === "excluded")
              .map((r) => r.scout_author_id),
          );
          const have = new Set(rows.map((r) => `${r.scout_author_id}:${r.book_id}`));
          const toAdd = books.filter(
            (b) => !blocked.has(b.scout_author_id) && !have.has(`${b.scout_author_id}:${b.id}`),
          );
          let added = 0;
          if (toAdd.length) {
            const { data: inserted, error } = await db
              .from("scout_prospects")
              .insert(
                toAdd.map((b) => ({
                  owner: access.owner,
                  scout_author_id: b.scout_author_id,
                  book_id: b.id,
                  status: "new",
                })),
              )
              .select("id");
            added = inserted?.length ?? 0;
            if (error) return json({ ok: false, error: "Could not mark the batch scouted." }, 500);
          }
          return json({ ok: true, added, skipped: books.length - added });
        } catch (err) {
          console.error("[scout-batches.$id.scout]", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
