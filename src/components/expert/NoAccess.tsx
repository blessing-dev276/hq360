import { useState } from "react";
import { Lock, Send, Sparkles } from "lucide-react";

const PITCH: Record<string, { quip: string; perks: string[] }> = {
  audit: {
    quip: "The audit room is invite only. The bouncer checked the list twice, and your name isn't on it. Yet.",
    perks: [
      "Research authors in depth",
      "Build evidence-led growth reports",
      "Share private audit links",
    ],
  },
  scout: {
    quip: "Scouts only beyond this rope. You'll need a badge before you can go author hunting.",
    perks: [
      "Discover authors by genre",
      "Run batches of up to 100",
      "Find and verify author emails",
    ],
  },
  invoices: {
    quip: "This is where the money moves, so the door has three locks. You're holding zero keys.",
    perks: [
      "Send branded proposals",
      "Share price quotes as links or PDFs",
      "Request invoices and track payment",
    ],
  },
  academy: {
    quip: "Trainers' lounge. There's coffee in here, but you'll need a trainer badge to get any.",
    perks: [
      "Coach your own trainees",
      "Review their chats and scores",
      "Shape the practice content",
    ],
  },
};

/** Shown when an expert opens a tool they haven't been given yet. */
export function NoAccess({ tool, label }: { tool: string; label: string }) {
  const pitch = PITCH[tool] ?? {
    quip: "This door is locked for now. Someone at HQ360 holds the key.",
    perks: [],
  };
  const [state, setState] = useState<"idle" | "busy" | "sent" | "already" | "error">("idle");
  async function request() {
    setState("busy");
    try {
      const res = await fetch("/api/expert/request-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool }),
      });
      const body = (await res.json().catch(() => ({}))) as { already?: boolean };
      setState(res.ok ? (body.already ? "already" : "sent") : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <section className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-border bg-card p-8 text-center sm:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(circle,rgba(255,90,0,0.18),transparent_65%)]"
      />
      <div className="relative mx-auto grid size-20 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary motion-safe:animate-[wiggle_2.4s_ease-in-out_infinite]">
        <Lock size={34} />
      </div>
      <p className="relative mt-6 inline-block -rotate-3 rounded-md border-2 border-primary px-3 py-1 font-mono text-xs font-bold tracking-[0.3em] text-primary">
        ACCESS DENIED
      </p>
      <h2 className="relative mt-5 font-display text-3xl tracking-tight sm:text-4xl">
        You're not on the {label} list
      </h2>
      <p className="relative mx-auto mt-3 max-w-md text-muted-foreground">{pitch.quip}</p>
      {pitch.perks.length > 0 && (
        <ul className="relative mx-auto mt-7 grid max-w-md gap-2 text-left text-sm">
          {pitch.perks.map((perk) => (
            <li
              key={perk}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3"
            >
              <Sparkles size={15} className="shrink-0 text-primary" />
              <span>
                <span className="text-muted-foreground">Unlocks: </span>
                {perk}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-8">
        {state === "sent" || state === "already" ? (
          <p role="status" className="font-medium text-primary">
            {state === "sent"
              ? "Request sent. HQ360 has been tapped on the shoulder."
              : "Already asked today. HQ360 has your request."}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void request()}
            disabled={state === "busy"}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <Send size={16} />
            {state === "busy" ? "Knocking..." : "Knock on the door (request access)"}
          </button>
        )}
        {state === "error" && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            The knock didn't land. Try again in a moment.
          </p>
        )}
      </div>
    </section>
  );
}
