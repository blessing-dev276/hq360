import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Trainer tools for the Author Engine content. Works with a trainer login or
// the /admin passphrase cookie.
//   GET    /api/academy/admin/content?table=response_bank
//   POST   /api/academy/admin/content { table, row }   (insert or update)
//   DELETE /api/academy/admin/content?table=hints&id=...
const EDITABLE = ["response_bank", "hints", "feedback", "model_lines"] as const;
const READABLE = [...EDITABLE, "weak_spots"] as const;

const rowSchemas = {
  response_bank: z.object({
    id: z.string().max(200).optional(),
    author: z.string().min(1).max(100),
    reaction: z.string().min(1).max(60),
    text: z.string().min(1).max(2000),
    active: z.boolean().optional(),
  }),
  hints: z.object({
    id: z.string().max(200).optional(),
    rule: z.string().min(1).max(60),
    text: z.string().min(1).max(1000),
  }),
  feedback: z.object({
    id: z.string().max(200).optional(),
    signal: z.string().min(1).max(60),
    kind: z.enum(["worked", "change", "summary"]),
    text: z.string().min(1).max(1000),
  }),
  model_lines: z.object({
    id: z.string().max(200).optional(),
    author: z.string().min(1).max(100),
    reaction: z.string().min(1).max(60),
    text: z.string().min(1).max(2000),
  }),
};

const ORDER: Record<(typeof READABLE)[number], string> = {
  response_bank: "author",
  hints: "rule",
  feedback: "signal",
  model_lines: "author",
  weak_spots: "created_at",
};

export const Route = createFileRoute("/api/academy/admin/content")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request)))
          return a.json({ ok: false, error: "forbidden" }, 403);
        const table = new URL(request.url).searchParams.get("table") ?? "";
        if (!(READABLE as readonly string[]).includes(table))
          return a.json({ ok: false, error: "invalid" }, 400);
        const t = table as (typeof READABLE)[number];

        const { data, error } = await a.db
          .from(t)
          .select("*")
          .order(ORDER[t], { ascending: t !== "weak_spots" })
          .limit(t === "weak_spots" ? 300 : 5000);
        if (error) return a.json({ ok: false, error: "storage" }, 500);

        // How often each bank line has been used across every session.
        let usage: Record<string, number> | undefined;
        if (t === "response_bank") {
          const { data: sessions } = await a.db.from("sessions").select("used_line_ids");
          usage = {};
          for (const s of (sessions ?? []) as { used_line_ids: string[] | null }[])
            for (const id of s.used_line_ids ?? []) usage[id] = (usage[id] ?? 0) + 1;
        }
        return a.json({ ok: true, rows: data ?? [], usage });
      },
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request)))
          return a.json({ ok: false, error: "forbidden" }, 403);
        let table: (typeof EDITABLE)[number];
        let row: Record<string, unknown>;
        try {
          const body = (await request.json()) as { table: string; row: unknown };
          if (!(EDITABLE as readonly string[]).includes(body.table)) throw new Error("table");
          table = body.table as (typeof EDITABLE)[number];
          row = rowSchemas[table].parse(body.row);
        } catch {
          return a.json({ ok: false, error: "invalid" }, 400);
        }
        const { data, error } = row.id
          ? await a.db.from(table).update(row).eq("id", row.id).select("*").single()
          : await a.db.from(table).insert(row).select("*").single();
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true, row: data });
      },
      DELETE: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        if (!(await a.isTrainerRequest(request)))
          return a.json({ ok: false, error: "forbidden" }, 403);
        const url = new URL(request.url);
        const table = url.searchParams.get("table") ?? "";
        const id = url.searchParams.get("id") ?? "";
        if (!(EDITABLE as readonly string[]).includes(table) || !id)
          return a.json({ ok: false, error: "invalid" }, 400);
        const { error } = await a.db.from(table).delete().eq("id", id);
        if (error) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true });
      },
    },
  },
});
