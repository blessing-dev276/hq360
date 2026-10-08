import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Admin control centre for the whole Academy: overview stats, every chat, AI
// and API usage, trainer keys, and the AI settings. Admin passphrase only.

type SessionLite = {
  id: string;
  user_id: string;
  persona: string;
  difficulty: string | null;
  mode: string;
  ended: boolean;
  created_at: string;
  stage: string;
  coaching: { overall?: number; outcome?: string } | null;
  messages: unknown[];
};
type UsageRow = {
  created_at: string;
  user_id: string | null;
  kind: string;
  outcome: string;
  model: string | null;
  key_owner: string | null;
  latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  error: string | null;
};

// Perplexity Agent API rates for openai/gpt-6-luna (per token), from billing.
const RATE = { input: 0.0000001, output: 0.0000005 };
const DAY = 86400_000;

const settingsInput = z.object({
  ai_enabled: z.boolean(),
  ai_reply: z.boolean(),
  ai_hint: z.boolean(),
  ai_coach: z.boolean(),
  model: z.string().trim().min(3).max(100),
  daily_ai_limit: z.number().int().min(0).max(100000),
});

async function handle(request: Request) {
  const { isAdminRequest } = await import("@/lib/admin-auth.server");
  const { db } = await import("@/lib/academy/academy.server");
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin" }, 403);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "overview";

  const names = async () => {
    const { data } = await db.from("profiles").select("id, full_name, email, role");
    const map = new Map<string, { name: string; role: string }>();
    for (const p of (data ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string;
    }[])
      map.set(p.id, { name: p.full_name || p.email || "Unknown", role: p.role });
    return map;
  };

  if (request.method === "PUT") {
    const parsed = settingsInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Check the settings." }, 400);
    const { error } = await db
      .from("academy_settings")
      .upsert({ id: "default", ...parsed.data, updated_at: new Date().toISOString() });
    if (error) return json({ error: "Could not save the settings." }, 503);
    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const chat = url.searchParams.get("chat");
    const key = url.searchParams.get("key");
    if (chat) {
      const { error } = await db.from("sessions").delete().eq("id", chat);
      return error ? json({ error: "Could not delete the chat." }, 503) : json({ ok: true });
    }
    if (key && /^[0-9a-f-]{36}$/.test(key)) {
      const type = url.searchParams.get("type");
      const { error } =
        type === "expert"
          ? await db.from("expert_perplexity_credentials").delete().eq("expert_id", key)
          : await db.from("academy_trainer_credentials").delete().eq("trainer_id", key);
      return error ? json({ error: "Could not remove the key." }, 503) : json({ ok: true });
    }
    return json({ error: "Nothing to delete." }, 400);
  }

  if (view === "settings") {
    const { data } = await db
      .from("academy_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    return json({ settings: data });
  }

  if (view === "chat") {
    const id = url.searchParams.get("id") ?? "";
    const { data } = await db.from("sessions").select("*").eq("id", id).maybeSingle();
    if (!data) return json({ error: "Chat not found." }, 404);
    const { findPersona } = await import("@/lib/academy/practice-data.server");
    const row = data as SessionLite & { challenge: string; mood: string };
    const persona = findPersona(row.persona);
    const who = (await names()).get(row.user_id);
    return json({ chat: { ...data, persona: persona ?? null, user: who ?? null } });
  }

  if (view === "chats") {
    const { data } = await db
      .from("sessions")
      .select(
        "id, user_id, persona, difficulty, mode, ended, created_at, stage, coaching, messages",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    const { findPersona } = await import("@/lib/academy/practice-data.server");
    const who = await names();
    return json({
      chats: ((data ?? []) as SessionLite[]).map((s) => ({
        id: s.id,
        user: who.get(s.user_id)?.name ?? "Unknown",
        author: findPersona(s.persona)?.name ?? s.persona,
        difficulty: s.difficulty ?? "medium",
        mode: s.mode,
        ended: s.ended,
        stage: s.stage,
        score: s.coaching?.overall ?? null,
        outcome: s.coaching?.outcome ?? null,
        messages: Array.isArray(s.messages) ? s.messages.length : 0,
        created_at: s.created_at,
      })),
    });
  }

  if (view === "ai") {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const [{ data: usage }, { data: academyKeys }, { data: expertKeys }] = await Promise.all([
      db
        .from("usage_log")
        .select(
          "created_at, user_id, kind, outcome, model, key_owner, latency_ms, input_tokens, output_tokens, error",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      db.from("academy_trainer_credentials").select("trainer_id, updated_at"),
      db
        .from("expert_perplexity_credentials")
        .select("expert_id, updated_at, expert_profiles!inner(full_name, email, academy_trainer)")
        .eq("expert_profiles.academy_trainer", true),
    ]);
    const rows = (usage ?? []) as UsageRow[];
    const who = await names();
    const cost = (r: UsageRow) => r.input_tokens * RATE.input + r.output_tokens * RATE.output;
    const byDay = new Map<string, { ai: number; fallback: number; other: number; cost: number }>();
    for (let i = 13; i >= 0; i--)
      byDay.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), {
        ai: 0,
        fallback: 0,
        other: 0,
        cost: 0,
      });
    for (const r of rows) {
      const d = byDay.get(r.created_at.slice(0, 10));
      if (!d) continue;
      if (r.outcome === "ai") d.ai++;
      else if (r.outcome === "fallback") d.fallback++;
      else d.other++;
      d.cost += cost(r);
    }
    const count = (f: (r: UsageRow) => boolean) => rows.filter(f).length;
    const byKey = new Map<string, { calls: number; cost: number }>();
    const byUser = new Map<string, { calls: number; cost: number }>();
    for (const r of rows.filter((x) => x.outcome === "ai")) {
      if (r.key_owner) {
        const k = byKey.get(r.key_owner) ?? { calls: 0, cost: 0 };
        k.calls++;
        k.cost += cost(r);
        byKey.set(r.key_owner, k);
      }
      if (r.user_id) {
        const u = byUser.get(r.user_id) ?? { calls: 0, cost: 0 };
        u.calls++;
        u.cost += cost(r);
        byUser.set(r.user_id, u);
      }
    }
    const ok = rows.filter((r) => r.outcome === "ai");
    return json({
      totals: {
        calls: rows.length,
        ai: ok.length,
        fallback: count((r) => r.outcome === "fallback"),
        off: count((r) => r.outcome === "off"),
        limit: count((r) => r.outcome === "limit"),
        noKey: count((r) => r.outcome === "no_key"),
        tokensIn: ok.reduce((n, r) => n + r.input_tokens, 0),
        tokensOut: ok.reduce((n, r) => n + r.output_tokens, 0),
        cost: rows.reduce((n, r) => n + cost(r), 0),
        avgLatency: ok.length
          ? Math.round(ok.reduce((n, r) => n + (r.latency_ms ?? 0), 0) / ok.length)
          : null,
        byKind: ["reply", "hint", "coach"].map((k) => ({
          kind: k,
          ai: count((r) => r.kind === k && r.outcome === "ai"),
          fallback: count((r) => r.kind === k && r.outcome !== "ai"),
        })),
      },
      days: [...byDay.entries()].map(([day, v]) => ({ day, ...v })),
      keys: [
        ...((academyKeys ?? []) as { trainer_id: string; updated_at: string }[]).map((k) => ({
          id: k.trainer_id,
          type: "academy",
          owner: who.get(k.trainer_id)?.name ?? "Trainer",
          updated_at: k.updated_at,
          ...(byKey.get(k.trainer_id) ?? { calls: 0, cost: 0 }),
        })),
        ...(
          (expertKeys ?? []) as unknown as {
            expert_id: string;
            updated_at: string;
            expert_profiles: { full_name: string | null; email: string };
          }[]
        ).map((k) => ({
          id: k.expert_id,
          type: "expert",
          owner: `${k.expert_profiles.full_name || k.expert_profiles.email} (expert)`,
          updated_at: k.updated_at,
          ...(byKey.get(k.expert_id) ?? { calls: 0, cost: 0 }),
        })),
      ],
      topUsers: [...byUser.entries()]
        .map(([id, v]) => ({ name: who.get(id)?.name ?? "Unknown", ...v }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10),
      recentErrors: rows
        .filter((r) => r.outcome === "fallback" && r.error)
        .slice(0, 10)
        .map((r) => ({
          at: r.created_at,
          kind: r.kind,
          error: r.error,
          user: r.user_id ? (who.get(r.user_id)?.name ?? "Unknown") : "-",
        })),
    });
  }

  // Overview
  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    db.from("profiles").select("id, role, created_at"),
    db
      .from("sessions")
      .select(
        "id, user_id, persona, difficulty, mode, ended, created_at, stage, coaching, messages",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  const ss = (sessions ?? []) as SessionLite[];
  const ps = (profiles ?? []) as { id: string; role: string; created_at: string }[];
  const now = Date.now();
  const within = (iso: string, days: number) => now - new Date(iso).getTime() < days * DAY;
  const scored = ss.filter((s) => s.ended && typeof s.coaching?.overall === "number");
  const avg = (list: SessionLite[]) =>
    list.length
      ? Math.round(list.reduce((n, s) => n + (s.coaching?.overall ?? 0), 0) / list.length)
      : null;
  const { findPersona } = await import("@/lib/academy/practice-data.server");
  const personaCounts = new Map<string, { chats: number; won: number }>();
  for (const s of ss) {
    const p = personaCounts.get(s.persona) ?? { chats: 0, won: 0 };
    p.chats++;
    if (s.coaching?.outcome === "won") p.won++;
    personaCounts.set(s.persona, p);
  }
  return json({
    people: {
      total: ps.length,
      trainers: ps.filter((p) => p.role === "trainer").length,
      trainees: ps.filter((p) => p.role !== "trainer").length,
      new7: ps.filter((p) => within(p.created_at, 7)).length,
      active7: new Set(ss.filter((s) => within(s.created_at, 7)).map((s) => s.user_id)).size,
    },
    chats: {
      total: ss.length,
      today: ss.filter((s) => within(s.created_at, 1)).length,
      week: ss.filter((s) => within(s.created_at, 7)).length,
      scored: scored.length,
      avgScore: avg(scored),
      won: scored.filter((s) => s.coaching?.outcome === "won").length,
    },
    difficulty: ["easy", "medium", "hard", "extreme"].map((d) => {
      const list = scored.filter((s) => (s.difficulty ?? "medium") === d);
      return {
        level: d,
        chats: ss.filter((s) => (s.difficulty ?? "medium") === d).length,
        avgScore: avg(list),
        winRate: list.length
          ? Math.round(
              (list.filter((s) => s.coaching?.outcome === "won").length / list.length) * 100,
            )
          : null,
      };
    }),
    authors: [...personaCounts.entries()]
      .map(([id, v]) => ({ name: findPersona(id)?.name ?? id, ...v }))
      .sort((a, b) => b.chats - a.chats),
  });
}

export const Route = createFileRoute("/api/admin/academy-control")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
    },
  },
});
