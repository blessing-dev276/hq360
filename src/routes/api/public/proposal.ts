import { createFileRoute } from "@tanstack/react-router";

/** The client-facing proposal behind a secret link. Counts a view. */
export const Route = createFileRoute("/api/public/proposal")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { json } = await import("@/lib/quotes.server");
        const { proposalsTable, PUBLIC_PROPOSAL_FIELDS } = await import("@/lib/proposals.server");
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim() ?? "";
        if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: "Proposal not found." }, 404);
        const { data, error } = await proposalsTable()
          .select(PUBLIC_PROPOSAL_FIELDS)
          .eq("token", token)
          .maybeSingle();
        if (error) return json({ error: "Proposal unavailable. Please try again." }, 503);
        if (!data) return json({ error: "Proposal not found." }, 404);
        if (url.searchParams.get("preview") !== "1") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
            .rpc("proposal_viewed", { p_token: token })
            .then(
              () => undefined,
              () => undefined,
            );
        }
        return json({ item: data });
      },
    },
  },
});
