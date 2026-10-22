import { createFileRoute } from "@tanstack/react-router";

const FIELDS =
  "id, kind, playbook, slug, number, part, group_name, title, summary, body, fields, svg, sort_order, published, published_at, lesson_date, updated_at, updated_by";

/** Published academy content records for signed in trainees and trainers. */
export const Route = createFileRoute("/api/academy/content")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.getViewer(request))) return a.json({ ok: false, error: "unauthorized" }, 401);
        const { data, error } = await a.db
          .from("academy_content")
          .select(FIELDS)
          .eq("published", true)
          .order("playbook")
          .order("kind")
          .order("sort_order")
          .order("number", { ascending: true, nullsFirst: false })
          .order("published_at", { ascending: false });
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true, records: data ?? [] });
      },
    },
  },
});
