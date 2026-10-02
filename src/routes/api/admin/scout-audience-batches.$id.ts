import { createFileRoute } from "@tanstack/react-router";
import { resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb } from "@/lib/scout/db";
import { z } from "zod";
export const Route = createFileRoute("/api/admin/scout-audience-batches/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        if (!z.string().uuid().safeParse(params.id).success)
          return Response.json({ ok: false, message: "Invalid batch." }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = asScoutDb(supabaseAdmin);
        const { data: batch, error: batchError } = await db
          .from("scout_audience_batches")
          .select("*")
          .eq("id", params.id)
          .eq("owner", access.owner)
          .maybeSingle();
        if (batchError)
          return Response.json(
            { ok: false, message: "Could not load this batch." },
            { status: 503 },
          );
        if (!batch)
          return Response.json({ ok: false, message: "Batch not found." }, { status: 404 });
        const { data, error } = await db
          .from("scout_audience_leads")
          .select("*, scout_audience_batch_leads!inner(batch_id)")
          .eq("scout_audience_batch_leads.batch_id", params.id)
          .order("name");
        if (error)
          return Response.json(
            { ok: false, message: "Could not load batch leads." },
            { status: 503 },
          );
        const { data: shortlist } = await db
          .from("scout_audience_shortlist")
          .select("lead_id")
          .eq("owner", access.owner)
          .in(
            "lead_id",
            (data ?? []).map((lead: { id: string }) => lead.id),
          );
        const shortlisted = new Set(
          (shortlist ?? []).map((row: { lead_id: string }) => row.lead_id),
        );
        return Response.json(
          {
            ok: true,
            batch,
            items: (data ?? []).map((lead: { id: string }) => ({
              ...lead,
              shortlisted: shortlisted.has(lead.id),
            })),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
