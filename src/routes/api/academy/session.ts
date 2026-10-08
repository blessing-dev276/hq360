import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  mode: z.enum(["cold", "no"]),
  difficulty: z.enum(["easy", "medium", "hard", "extreme"]).default("medium"),
});

export const Route = createFileRoute("/api/academy/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const a = await import("@/lib/academy/academy.server");
        const data = await import("@/lib/academy/practice-data.server");
        const viewer = await a.getViewer(request);
        if (!viewer) return a.json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return a.json({ ok: false, error: "invalid" }, 400);
        }
        // The ladder: trainees can only pick levels they have unlocked.
        const progress = await a.progressFor(viewer, 0);
        const lvl = progress.levels.find((l) => l.level === body.difficulty);
        if (lvl && !lvl.unlocked)
          return a.json(
            {
              ok: false,
              error: "locked",
              message: `Locked. Score ${70}+ in ${lvl.need} more chat${lvl.need === 1 ? "" : "s"} on the level below to unlock ${body.difficulty}.`,
            },
            403,
          );

        // Walking away still counts: unfinished chats are scored, empty ones dropped.
        const { data: open } = await a.db
          .from("sessions")
          .select("*")
          .eq("user_id", viewer.id)
          .eq("ended", false);
        const scored: { author: string; overall: number }[] = [];
        for (const row of (open ?? []) as import("@/lib/academy/academy.server").SessionRow[]) {
          if (!row.messages.some((m) => m.role === "scout")) {
            await a.db.from("sessions").delete().eq("id", row.id);
            continue;
          }
          try {
            const done = await a.finishSession(row, true);
            const { findPersona } = await import("@/lib/academy/practice-data.server");
            scored.push({
              author: findPersona(row.persona)?.name ?? "your last author",
              overall: done.coaching.overall,
            });
          } catch {
            /* scoring failed; the chat stays open in My chats */
          }
        }

        const { startingTrust, stageOf, DIFFICULTIES } =
          await import("@/lib/academy/engine.server");
        const level = DIFFICULTIES[body.difficulty];
        const pool = data.PERSONAS_BY_DIFFICULTY[body.difficulty] ?? [];
        const persona = data.pick(
          pool.length ? data.AUTHORS.filter((p) => pool.includes(p.id)) : data.AUTHORS,
        );
        // Beginners don't get the grumpiest moods.
        const mood = data.pick(
          body.difficulty === "easy"
            ? data.MOODS.filter((m) => !/irritated|tired/.test(m))
            : data.MOODS,
        );
        const challenge = data.pick(level.styles);
        const trust = startingTrust(challenge, body.mode, mood, body.difficulty);
        const [lo, hi] = level.silent;
        // "They said no" has already replied, so no silent phase.
        const silentLeft = body.mode === "no" ? 0 : lo + Math.floor(Math.random() * (hi - lo + 1));
        const messages: import("@/lib/academy/academy.server").Msg[] =
          body.mode === "no"
            ? [
                {
                  role: "sys",
                  text: "You already sent a first pitch. This is the author's reply.",
                },
                { role: "author", text: persona.no },
              ]
            : [];
        const { data: row, error } = await a.db
          .from("sessions")
          .insert({
            id: crypto.randomUUID(),
            user_id: viewer.id,
            persona: persona.id,
            mood,
            challenge,
            mode: body.mode,
            messages,
            trust,
            stage: stageOf(trust),
            trust_history: [trust],
            difficulty: body.difficulty,
            silent_left: silentLeft,
          })
          .select("*")
          .single();
        if (error || !row) return a.json({ ok: false, error: "storage" }, 500);
        return a.json({ ok: true, session: a.clientSession(row as never), scored });
      },
    },
  },
});
