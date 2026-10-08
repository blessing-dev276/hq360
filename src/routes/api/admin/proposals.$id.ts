import { createFileRoute } from "@tanstack/react-router";

async function owned(request: Request, id: string) {
  const { quoteAccess } = await import("@/lib/quotes.server");
  const { proposalsTable, PROPOSAL_FIELDS } = await import("@/lib/proposals.server");
  const who = await quoteAccess(request);
  if (!who) return { who: null, row: null };
  if (!/^[0-9a-f-]{36}$/.test(id)) return { who, row: null };
  let query = proposalsTable().select(PROPOSAL_FIELDS).eq("id", id);
  if (!who.admin) query = query.eq("owner", who.owner);
  const { data } = await query.maybeSingle();
  return { who, row: data as Record<string, string> | null };
}

export const Route = createFileRoute("/api/admin/proposals/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const { json } = await import("@/lib/quotes.server");
        const { proposalsTable, PROPOSAL_FIELDS, proposalInput } =
          await import("@/lib/proposals.server");
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { who, row } = await owned(request, params.id);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (!row) return json({ error: "Proposal not found." }, 404);
        const parsed = proposalInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check the proposal." }, 400);
        const { data, error } = await proposalsTable()
          .update({ ...parsed.data, updated_at: new Date().toISOString() })
          .eq("id", params.id)
          .select(PROPOSAL_FIELDS)
          .single();
        if (error || !data) return json({ error: "Could not save the proposal." }, 503);
        return json({ item: data });
      },
      DELETE: async ({ request, params }) => {
        const { json } = await import("@/lib/quotes.server");
        const { proposalsTable } = await import("@/lib/proposals.server");
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { who, row } = await owned(request, params.id);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (!row) return json({ error: "Proposal not found." }, 404);
        const { error } = await proposalsTable().delete().eq("id", params.id);
        if (error) return json({ error: "Could not delete the proposal." }, 503);
        return json({ ok: true });
      },
      /** Send the proposal link to the client's email. */
      POST: async ({ request, params }) => {
        const { json } = await import("@/lib/quotes.server");
        const { proposalsTable, PROPOSAL_FIELDS, emailProposal } =
          await import("@/lib/proposals.server");
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { who, row } = await owned(request, params.id);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (!row) return json({ error: "Proposal not found." }, 404);
        try {
          await emailProposal(row as never);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "Could not send." }, 502);
        }
        const { data } = await proposalsTable()
          .update({ sent_at: new Date().toISOString(), sent_to: row.client_email })
          .eq("id", params.id)
          .select(PROPOSAL_FIELDS)
          .single();
        return json({ item: data ?? row });
      },
    },
  },
});
