import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

type State = "idle" | "sending" | "done" | "error";

export function NewsletterSignup({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  const dark = variant === "dark";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/public/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          sourcePath: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      setState(res.ok && body.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className={cn("text-sm", dark ? "text-brand" : "text-brand")}>
        You are on the list. Look out for practical notes from HQ360.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
      <label htmlFor={`news-${variant}`} className="sr-only">
        Email address
      </label>
      <input
        id={`news-${variant}`}
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className={cn(
          "w-full rounded-full border px-5 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dark
            ? "border-white/20 bg-white/5 text-[oklch(0.97_0.006_90)] placeholder:text-[oklch(0.66_0.008_90)]"
            : "border-border bg-card text-foreground placeholder:text-muted-foreground",
        )}
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {state === "sending" ? "Subscribing" : "Subscribe"}
      </button>
      {state === "error" ? (
        <span
          role="alert"
          className={cn("text-xs", dark ? "text-[oklch(0.8_0.09_40)]" : "text-destructive")}
        >
          Something went wrong. Try again.
        </span>
      ) : null}
    </form>
  );
}
