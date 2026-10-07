import { createFileRoute } from "@tanstack/react-router";

/** The buyer-facing quote behind a secret link. Counts a view. */
export const Route = createFileRoute("/api/public/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { quotesTable, json } = await import("@/lib/quotes.server");
        const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
        if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: "Quote not found." }, 404);
        const { data, error } = await quotesTable()
          .select(
            "token, prepared_by, client_name, project_title, intro, currency, packages, notes, valid_until, created_at, updated_at",
          )
          .eq("token", token)
          .maybeSingle();
        if (error) return json({ error: "Quote unavailable. Please try again." }, 503);
        if (!data) return json({ error: "Quote not found." }, 404);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (new URL(request.url).searchParams.get("preview") !== "1")
          await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
            .rpc("price_quote_viewed", { p_token: token })
            .then(
              () => undefined,
              () => undefined,
            );
        return json({ item: data });
      },
    },
  },
});
