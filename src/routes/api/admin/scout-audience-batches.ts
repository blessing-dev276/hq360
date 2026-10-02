import { createFileRoute } from "@tanstack/react-router";
import { resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb } from "@/lib/scout/db";
import { SCOUT_AUDIENCES } from "@/lib/scout/audiences";
import { audienceSearchSchema, searchAudience } from "@/lib/scout/audience-search.server";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const Route = createFileRoute("/api/admin/scout-audience-batches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        const audience = new URL(request.url).searchParams.get("audience");
        if (!SCOUT_AUDIENCES.some((item) => item.id === audience))
          return json({ ok: false, message: "Choose an audience." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await asScoutDb(supabaseAdmin)
          .from("scout_audience_batches")
          .select("*")
          .eq("audience", audience)
          .eq("owner", access.owner)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error)
          return json(
            {
              ok: false,
              message:
                "Could not load audience batches. Please retry or ask an administrator to check Scouting setup.",
            },
            503,
          );
        return json({ ok: true, items: data ?? [] });
      },
      POST: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = audienceSearchSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json(
            { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid search." },
            400,
          );
        const input = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = asScoutDb(supabaseAdmin);
        // Check storage before consuming search credits. UUID makes a retried POST idempotent.
        const { data: existing, error: setupError } = await db
          .from("scout_audience_batches")
          .select("*")
          .eq("id", input.requestId)
          .maybeSingle();
        if (setupError)
          return json(
            {
              ok: false,
              message:
                "Audience Scouting storage is not ready. Ask an administrator to finish setup.",
            },
            503,
          );
        if (existing) {
          if ((existing as { owner?: string }).owner !== access.owner)
            return json({ ok: false, message: "Start a new search." }, 409);
          return json({ ok: true, batch: existing });
        }
        try {
          const { items, query } = await searchAudience(
            input,
            AbortSignal.any([request.signal, AbortSignal.timeout(35000)]),
          );
          const audience = SCOUT_AUDIENCES.find((item) => item.id === input.audience)!;
          const { error } = await db.rpc("scout_save_audience_batch", {
            p_id: input.requestId,
            p_audience: input.audience,
            p_source: input.source,
            p_label: `${audience.label} · ${input.niche} · ${input.location || "Any location"} · ${input.source === "maps" ? "Maps" : "Web"} · Page ${input.page}`,
            p_query: query,
            p_location: input.location,
            p_page: input.page,
            p_limit: input.limit,
            p_items: items,
          });
          // The save RPC is shared; claim the new batch for this workspace.
          const claimed = error
            ? { error }
            : await db
                .from("scout_audience_batches")
                .update({ owner: access.owner })
                .eq("id", input.requestId);
          if (error || claimed.error)
            return json(
              {
                ok: false,
                message: "Search completed but the batch could not be saved. Retry the search.",
              },
              503,
            );
          const { data: batch, error: readError } = await db
            .from("scout_audience_batches")
            .select("*")
            .eq("id", input.requestId)
            .single();
          if (readError)
            return json(
              { ok: false, message: "Batch saved, but could not be opened. Retry to recover it." },
              503,
            );
          return json({ ok: true, batch }, 201);
        } catch (error) {
          return json(
            {
              ok: false,
              message:
                error instanceof Error &&
                error.name !== "TimeoutError" &&
                error.name !== "AbortError"
                  ? error.message
                  : "Search timed out. Please retry.",
            },
            503,
          );
        }
      },
    },
  },
});
