import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ownsBatch, resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb } from "@/lib/scout/db";
import { ARC_SOURCES, isArcSource } from "@/lib/scout/arc-sources";
const json = (body: unknown, status = 200) => Response.json(body, { status });
export const Route = createFileRoute("/api/admin/scout-arc-discovery")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ error: "unauthorized" }, 401);
        const params = new URL(request.url).searchParams,
          source = params.get("source") ?? "",
          id = params.get("batchId");
        if (!isArcSource(source) || (id && !z.string().uuid().safeParse(id).success))
          return json({ error: "Invalid source or batch." }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          if (id) {
            if (!(await ownsBatch(db, access.owner, id)))
              return json({ error: "Batch not found." }, 404);
            const result = await db
              .from("scout_arc_listings")
              .select("*")
              .eq("batch_id", id)
              .eq("source", source);
            if (result.error) throw result.error;
            return json({ items: result.data });
          }
          const result = await db
            .from("scout_batches")
            .select("id,label,created_at,sources,item_count")
            .contains("sources", [source])
            .eq("owner", access.owner)
            .order("created_at", { ascending: false });
          if (result.error) throw result.error;
          return json({ items: result.data });
        } catch {
          return json({ error: "Could not load saved discoveries. Try again." }, 503);
        }
      },
      POST: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ error: "unauthorized" }, 401);
        const { arcSearchSchema, discoverArc } = await import("@/lib/scout/arc-discovery.server");
        const parsed = arcSearchSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message ?? "Invalid search." }, 400);
        const input = parsed.data;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const prior = await db
            .from("scout_batches")
            .select("*")
            .eq("id", input.requestId)
            .maybeSingle();
          if (prior.error) throw prior.error;
          if (prior.data) {
            if (prior.data.owner !== access.owner)
              return json({ error: "Start a new search." }, 409);
            if (!prior.data.sources.includes(input.source))
              return json({ error: "Request already used for another source." }, 409);
            return json({ batch: prior.data, message: "Saved batch restored." });
          }
          let found;
          try {
            found = await discoverArc(
              input,
              AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
            );
          } catch (error) {
            console.error(
              "[arc discovery]",
              error instanceof Error ? error.message : "discovery failed",
            );
            return json(
              {
                error:
                  input.source === "booksirens"
                    ? "Public catalogue discovery is unavailable for this selection. Try All genres, or add a listing URL."
                    : "Discovery could not complete. Try again or add a listing URL.",
              },
              502,
            );
          }
          if (!found.items.length)
            return json({
              empty: true,
              message: "No books found. No batch was saved. Try another genre or source.",
            });
          const label = `${ARC_SOURCES[input.source].name} · ${input.genre || "All genres"} · ${input.listingUrl ? "Added link" : input.source === "booksirens" ? "Catalogue sample" : input.source === "booknotification" ? "Upcoming releases" : `Page ${input.page}`}`;
          const saved = await db.rpc("scout_save_arc_batch", {
            p_id: input.requestId,
            p_source: input.source,
            p_label: label,
            p_genre: input.genre,
            p_items: found.items,
          });
          if (saved.error) throw saved.error;
          // The save RPC is shared; claim the new batch for this workspace.
          const claimed = await db
            .from("scout_batches")
            .update({ owner: access.owner })
            .eq("id", input.requestId);
          if (claimed.error) throw claimed.error;
          return json({
            batch: {
              id: input.requestId,
              label,
              sources: [input.source],
              item_count: found.items.length,
              created_at: new Date().toISOString(),
            },
            message: `${found.items.length} listings saved. ${found.checked} public records checked; ${found.skipped} unavailable pages skipped. Publication dates and review counts may be unknown.`,
          });
        } catch {
          return json(
            { error: "Could not save this search. Retry to recover the same batch." },
            503,
          );
        }
      },
      PATCH: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ error: "unauthorized" }, 401);
        const body = z
          .object({ listingId: z.string().uuid(), bookId: z.string().uuid() })
          .safeParse(await request.json().catch(() => null));
        if (!body.success) return json({ error: "Invalid listing." }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const listing = await db
            .from("scout_arc_listings")
            .select("*")
            .eq("id", body.data.listingId)
            .single();
          if (listing.error) throw listing.error;
          if (!(await ownsBatch(db, access.owner, listing.data.batch_id)))
            return json({ error: "Listing not found." }, 404);
          const book = await db
            .from("scout_discovered_books")
            .select("id,source_slug,source_url")
            .eq("id", body.data.bookId)
            .single();
          if (book.error) throw book.error;
          const member = await db
            .from("scout_batch_books")
            .select("book_id")
            .eq("batch_id", listing.data.batch_id)
            .eq("book_id", body.data.bookId)
            .maybeSingle();
          if (member.error) throw member.error;
          if (
            !member.data ||
            book.data.source_slug !== listing.data.source ||
            book.data.source_url !== listing.data.source_url
          )
            return json({ error: "Book does not match this listing." }, 400);
          const result = await db
            .from("scout_arc_listings")
            .update({ book_id: body.data.bookId })
            .eq("id", body.data.listingId);
          if (result.error) throw result.error;
          return json({ ok: true });
        } catch {
          return json(
            { error: "Could not link the saved author. Retry saving this listing." },
            503,
          );
        }
      },
    },
  },
});
