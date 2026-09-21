import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, type ScoutAuthor, type ScoutBook } from "@/lib/scout/db";
import { SOURCE_ADAPTERS } from "@/lib/scout/adapters";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const discoverSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    genre: z.string().trim().max(80).optional(),
    sources: z.array(z.string()).optional(),
    maxResults: z.number().int().positive().max(40).optional(),
  })
  // A genre alone is a valid discovery query (browse by genre); at least
  // one of query/genre must be given so the adapters have something to
  // search on. Country isn't offered here -- Google Books/Open Library
  // don't expose author nationality, so it can only be applied as a filter
  // on already-discovered/researched authors (see scout-books.ts), not as
  // a discovery-time query.
  .refine((v) => Boolean(v.query?.trim() || v.genre?.trim()), {
    message: "query_or_genre_required",
  });

export const Route = createFileRoute("/api/admin/scout-discover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof discoverSchema>;
        try {
          body = discoverSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { crawlSource } = await import("@/lib/scout/crawler.server");
          const slugs = body.sources?.length ? body.sources : Object.keys(SOURCE_ADAPTERS);
          const { data: batch, error } = await db
            .from("scout_batches")
            .insert({
              label: body.query || `Genre: ${body.genre}`,
              sources: slugs,
              query: body.query ?? null,
              genre: body.genre ?? null,
              requested_max: body.maxResults ?? 40,
            })
            .select("id")
            .single();
          if (error) throw error;
          const items: { author: ScoutAuthor; book: ScoutBook }[] = [];
          const results = [];
          for (const slug of slugs) {
            if (!SOURCE_ADAPTERS[slug]) continue;
            try {
              const result = await crawlSource(
                slug,
                { query: body.query ?? "", genre: body.genre, maxResults: body.maxResults },
                false,
                batch.id,
              );
              results.push(result);
              items.push(...result.items);
            } catch (error) {
              results.push({
                slug,
                status: "failed",
                error: error instanceof Error ? error.message : "Crawl failed",
              });
            }
          }
          const unique = [...new Map(items.map((i) => [i.book.id, i])).values()];
          const { error: updateError } = await db
            .from("scout_batches")
            .update({ item_count: unique.length })
            .eq("id", batch.id);
          if (updateError) throw updateError;
          return json({
            ok: true,
            items: unique,
            count: unique.length,
            batchId: batch.id,
            totalAvailable: null,
            results,
          });
        } catch (err) {
          console.error("[admin/scout-discover] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
