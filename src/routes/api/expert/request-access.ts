import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const TOOL_LABELS: Record<string, string> = {
  audit: "Audit",
  scout: "Scouting",
  invoices: "Sales",
  academy: "Academy trainer",
};

// An expert asks the admin for a tool they don't have yet. Lands in the admin
// notification bell; one request per tool per day.
export const Route = createFileRoute("/api/expert/request-access")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { isExpertRequest, expertProfiles } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const parsed = z
          .object({ tool: z.enum(["audit", "scout", "invoices", "academy"]) })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Unknown tool." }, 400);
        const label = TOOL_LABELS[parsed.data.tool]!;
        const { data } = await expertProfiles()
          .select("full_name, email")
          .eq("id", expertId)
          .maybeSingle();
        const who =
          (data as { full_name: string | null; email: string } | null)?.full_name ||
          (data as { email: string } | null)?.email ||
          "An expert";
        const title = `${who} asked for ${label} access`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
        const { data: recent } = await db
          .from("notifications")
          .select("id")
          .eq("audience", "admin")
          .eq("title", title)
          .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
          .limit(1);
        if (recent?.length) return json({ ok: true, already: true });
        const { error } = await db.rpc("hq_notify", {
          p_audience: "admin",
          p_expert: null,
          p_kind: "access_request",
          p_title: title,
          p_body: `Open Experts → Access to grant ${label}.`,
          p_tab: "experts",
        });
        return error ? json({ error: "Could not send your request." }, 503) : json({ ok: true });
      },
    },
  },
});
