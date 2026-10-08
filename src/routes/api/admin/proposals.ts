import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/proposals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { quoteAccess, json } = await import("@/lib/quotes.server");
        const { proposalsTable, PROPOSAL_FIELDS } = await import("@/lib/proposals.server");
        const who = await quoteAccess(request);
        if (!who) return json({ error: "Unauthorized" }, 401);
        let query = proposalsTable()
          .select(PROPOSAL_FIELDS)
          .order("updated_at", { ascending: false })
          .limit(200);
        if (!who.admin) query = query.eq("owner", who.owner);
        const { data, error } = await query;
        if (error) return json({ error: "Could not load proposals." }, 503);
        return json({ items: data ?? [], me: { name: who.name, admin: who.admin } });
      },
      POST: async ({ request }) => {
        const { quoteAccess, json } = await import("@/lib/quotes.server");
        const { proposalsTable, PROPOSAL_FIELDS, proposalInput } =
          await import("@/lib/proposals.server");
        const who = await quoteAccess(request);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = proposalInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check the proposal." }, 400);
        const { data, error } = await proposalsTable()
          .insert({ ...parsed.data, owner: who.owner })
          .select(PROPOSAL_FIELDS)
          .single();
        if (error || !data) return json({ error: "Could not save the proposal." }, 503);
        return json({ item: data }, 201);
      },
    },
  },
});
