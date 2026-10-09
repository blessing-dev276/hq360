import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/quotes/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const { quoteAccess, quotesTable, QUOTE_FIELDS, json } =
          await import("@/lib/quotes.server");
        const who = await quoteAccess(request);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { quoteInput } = await import("@/lib/quotes-schema.server");
        const parsed = quoteInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check the quote." }, 400);
        let query = quotesTable()
          .update({ ...parsed.data, updated_at: new Date().toISOString() })
          .eq("id", params.id);
        if (!who.admin) query = query.eq("owner", who.owner);
        const { data, error } = await query.select(QUOTE_FIELDS).maybeSingle();
        if (error) return json({ error: "Could not save the quote." }, 503);
        if (!data) return json({ error: "Quote not found." }, 404);
        return json({ item: data });
      },
      DELETE: async ({ request, params }) => {
        const { quoteAccess, quotesTable, json } = await import("@/lib/quotes.server");
        const who = await quoteAccess(request);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        let query = quotesTable().delete().eq("id", params.id);
        if (!who.admin) query = query.eq("owner", who.owner);
        const { error } = await query;
        if (error)
          return json(
            {
              error:
                error.code === "23503"
                  ? "This quote is linked to an invoice or invoice request and cannot be deleted."
                  : "Could not delete the quote.",
            },
            error.code === "23503" ? 409 : 503,
          );
        return json({ ok: true });
      },
    },
  },
});
