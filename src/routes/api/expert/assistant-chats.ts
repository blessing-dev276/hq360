import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const saveSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    // Messages as the chat shows them (screenshots are never stored).
    messages: z.array(z.record(z.string(), z.unknown())).max(200),
  })
  .strict();

async function context(request: Request, write: boolean) {
  const { trackerActor } = await import("@/lib/trackers/actor.server");
  const actor = await trackerActor(request, write);
  if (actor instanceof Response) return actor;
  const { db } = await import("@/lib/trackers/service.server");
  const owner = actor.role === "admin" ? "admin" : actor.expertId;
  return { owner, table: () => db().from("assistant_conversations") };
}

/** AI Assistant chat history for the signed-in admin workspace or expert. */
export const Route = createFileRoute("/api/expert/assistant-chats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const c = await context(request, false);
        if (c instanceof Response) return c;
        const id = new URL(request.url).searchParams.get("id");
        if (id) {
          if (!z.string().uuid().safeParse(id).success) return json({ error: "Invalid id." }, 400);
          const { data, error } = await c
            .table()
            .select("id, title, messages, updated_at")
            .eq("id", id)
            .eq("owner", c.owner)
            .maybeSingle();
          if (error) return json({ error: "Chat history is unavailable." }, 503);
          return data ? json({ chat: data }) : json({ error: "Chat not found." }, 404);
        }
        const { data, error } = await c
          .table()
          .select("id, title, updated_at")
          .eq("owner", c.owner)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (error) return json({ error: "Chat history is unavailable." }, 503);
        return json({ chats: data ?? [] });
      },
      PUT: async ({ request }) => {
        const c = await context(request, true);
        if (c instanceof Response) return c;
        const raw = await request.text();
        if (raw.length > 400_000) return json({ error: "This chat is too long to save." }, 413);
        const parsed = saveSchema.safeParse(JSON.parse(raw || "null"));
        if (!parsed.success) return json({ error: "Invalid chat." }, 400);
        const { id, title, messages } = parsed.data;
        const { data: existing } = await c.table().select("owner").eq("id", id).maybeSingle();
        if (existing && (existing as { owner: string }).owner !== c.owner)
          return json({ error: "Chat not found." }, 404);
        const { error } = await c
          .table()
          .upsert({ id, owner: c.owner, title, messages, updated_at: new Date().toISOString() });
        return error ? json({ error: "Could not save this chat." }, 503) : json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const c = await context(request, true);
        if (c instanceof Response) return c;
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!z.string().uuid().safeParse(id).success) return json({ error: "Invalid id." }, 400);
        const { error } = await c.table().delete().eq("id", id).eq("owner", c.owner);
        return error ? json({ error: "Could not delete this chat." }, 503) : json({ ok: true });
      },
    },
  },
});
