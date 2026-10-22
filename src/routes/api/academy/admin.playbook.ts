import { createFileRoute } from "@tanstack/react-router";

// Trainer editor for academy content records (chapters, niche guides, daily
// lessons, diagrams). Every save is versioned by a database trigger with the
// editor's name and the date.
//   GET    /api/academy/admin/playbook               all records, drafts included
//   GET    /api/academy/admin/playbook?versions=<id> version history of one record
//   POST   /api/academy/admin/playbook { record }    insert or update
//   DELETE /api/academy/admin/playbook?id=<id>

async function editorName(request: Request) {
  const a = await import("@/lib/academy/academy.server");
  const viewer = await a.getViewer(request);
  return viewer?.name || viewer?.email || "Administrator";
}

export const Route = createFileRoute("/api/academy/admin/playbook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request))) return a.json({ ok: false, error: "forbidden" }, 403);
        const versions = new URL(request.url).searchParams.get("versions");
        if (versions) {
          const { data, error } = await a.db
            .from("academy_content_versions")
            .select("version, snapshot, editor, edited_at")
            .eq("content_id", versions)
            .order("version", { ascending: false })
            .limit(100);
          if (error) return a.json({ ok: false, error: "storage" }, 500);
          return a.json({ ok: true, versions: data ?? [] });
        }
        const { data, error } = await a.db
          .from("academy_content")
          .select("*")
          .order("playbook")
          .order("kind")
          .order("sort_order")
          .order("number", { ascending: true, nullsFirst: false });
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true, records: data ?? [] });
      },
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request))) return a.json({ ok: false, error: "forbidden" }, 403);
        const { contentInputSchema, targetingPolicyIssues } = await import("@/lib/academy/content");
        const body = (await request.json().catch(() => null)) as { record?: unknown } | null;
        const parsed = contentInputSchema.safeParse(body?.record);
        if (!parsed.success)
          return a.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }, 400);
        const { id, ...record } = parsed.data;
        const issues = targetingPolicyIssues(record);
        if (record.published && issues.length)
          return a.json(
            {
              ok: false,
              error: `HQ360 does not target African countries. Remove: ${issues.join(", ")}.`,
            },
            400,
          );
        const row = { ...record, svg: record.svg || null, updated_by: await editorName(request) };
        const { data, error } = id
          ? await a.db.from("academy_content").update(row).eq("id", id).select("*").single()
          : await a.db.from("academy_content").insert(row).select("*").single();
        if (error)
          return a.json(
            { ok: false, error: error.code === "23505" ? "That slug is already used." : "storage" },
            error.code === "23505" ? 409 : 500,
          );
        return a.json({ ok: true, record: data });
      },
      DELETE: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request))) return a.json({ ok: false, error: "forbidden" }, 403);
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/.test(id)) return a.json({ ok: false, error: "invalid" }, 400);
        const { error } = await a.db.from("academy_content").delete().eq("id", id);
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true });
      },
    },
  },
});
