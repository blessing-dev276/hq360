import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/quotes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { quoteAccess, quotesTable, QUOTE_FIELDS, json } =
          await import("@/lib/quotes.server");
        const who = await quoteAccess(request);
        if (!who) return json({ error: "Unauthorized" }, 401);
        let query = quotesTable()
          .select(QUOTE_FIELDS)
          .order("updated_at", { ascending: false })
          .limit(200);
        if (!who.admin) query = query.eq("owner", who.owner);
        const { data, error } = await query;
        if (error) return json({ error: "Could not load quotes." }, 503);
        return json({ items: data ?? [], me: { name: who.name, admin: who.admin } });
      },
      POST: async ({ request }) => {
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
        const { data, error } = await quotesTable()
          .insert({ ...parsed.data, owner: who.owner })
          .select(QUOTE_FIELDS)
          .single();
        if (error || !data) return json({ error: "Could not save the quote." }, 503);
        return json({ item: data }, 201);
      },
    },
  },
});
