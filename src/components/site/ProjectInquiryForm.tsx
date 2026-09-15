import { useState, type FormEvent } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { CAPABILITIES } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";

const HELP_OPTIONS = CAPABILITIES.map((c) => c.name);
const BUDGETS = ["Not sure yet", "Under $5k", "$5k – $15k", "$15k – $50k", "$50k+"];
const TIMELINES = ["As soon as possible", "Within 1–3 months", "In 3–6 months", "Just exploring"];

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  company: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  helpWith: z.array(z.string()).min(1, "Pick at least one area"),
  primaryGoal: z.string().optional(),
  budgetRange: z.string().optional(),
  timeline: z.string().optional(),
  message: z.string().optional(),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>> & { form?: string };

export function ProjectInquiryForm({
  defaultIndustry,
  sourceIndustry,
  className,
  compact = false,
  helpOptions = HELP_OPTIONS,
}: {
  /** Prefill the industry select (Industry.shortName). */
  defaultIndustry?: string;
  /** The industry landing page this form was rendered on. */
  sourceIndustry?: string;
  className?: string;
  compact?: boolean;
  /** Optional vertical-specific service choices. */
  helpOptions?: string[];
}) {
  const [helpWith, setHelpWith] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [honey, setHoney] = useState("");

  function toggleHelp(v: string) {
    setHelpWith((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const fd = new FormData(e.currentTarget);
    const candidate = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      website: String(fd.get("website") ?? "").trim(),
      industry: String(fd.get("industry") ?? "").trim(),
      helpWith,
      primaryGoal: String(fd.get("primaryGoal") ?? "").trim(),
      budgetRange: String(fd.get("budgetRange") ?? "").trim(),
      timeline: String(fd.get("timeline") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
    };

    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as keyof Errors] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setState("sending");

    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          sourceIndustry: sourceIndustry ?? "",
          sourcePath: typeof window !== "undefined" ? window.location.pathname : "",
          company_url: honey,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && body.ok) {
        setState("done");
      } else {
        setState("idle");
        setErrors({ form: "We could not send that. Try again, or email us directly." });
      }
    } catch {
      setState("idle");
      setErrors({ form: "Network error. Try again, or email us directly." });
    }
  }

  if (state === "done") {
    return (
      <div
        role="status"
        className={cn(
          "rounded-3xl border border-border bg-card p-8 text-center shadow-editorial",
          className,
        )}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-[oklch(0.42_0.16_42)]">
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-2xl">Thanks — that's in.</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          We read every enquiry ourselves and reply within one working day, usually with a first
          view of what we would do and whether we are the right fit.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "rounded-3xl border border-border bg-card p-6 shadow-editorial sm:p-8",
        className,
      )}
    >
      <div className="grid gap-5">
        <div className={cn("grid gap-5", !compact && "sm:grid-cols-2")}>
          <Field label="Full name" error={errors.name}>
            <input name="name" type="text" autoComplete="name" className={inputCls} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input name="email" type="email" autoComplete="email" className={inputCls} />
          </Field>
        </div>

        <div className={cn("grid gap-5", !compact && "sm:grid-cols-2")}>
          <Field label="Company" hint="Optional">
            <input name="company" type="text" autoComplete="organization" className={inputCls} />
          </Field>
          <Field label="Website" hint="Optional">
            <input
              name="website"
              type="text"
              inputMode="url"
              placeholder="yourbusiness.com"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Industry">
          <select name="industry" defaultValue={defaultIndustry ?? ""} className={inputCls}>
            <option value="">Select an industry</option>
            {INDUSTRIES.map((i) => (
              <option key={i.slug} value={i.shortName}>
                {i.shortName}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            What do you need help with?
          </legend>
          {errors.helpWith ? (
            <p className="mt-1 text-xs text-destructive">{errors.helpWith}</p>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {helpOptions.map((opt) => (
              <label
                key={opt}
                className={cn(
                  // Explicit text-foreground on both states: this form can sit on a
                  // dark section (e.g. an industry page's final CTA), and without it
                  // the label inherits that section's light text onto a light pill —
                  // invisible text.
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm text-foreground transition-colors",
                  helpWith.includes(opt)
                    ? "border-brand bg-brand-soft"
                    : "border-border bg-background hover:border-foreground/30",
                )}
              >
                <input
                  type="checkbox"
                  checked={helpWith.includes(opt)}
                  onChange={() => toggleHelp(opt)}
                  className="size-4 accent-[var(--brand)]"
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Primary goal" hint="Optional">
          <input
            name="primaryGoal"
            type="text"
            placeholder="e.g. Book 20 qualified calls a month"
            className={inputCls}
          />
        </Field>

        <div className={cn("grid gap-5", !compact && "sm:grid-cols-2")}>
          <Field label="Approximate budget">
            <select name="budgetRange" defaultValue="" className={inputCls}>
              <option value="">Select a range</option>
              {BUDGETS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timeline">
            <select name="timeline" defaultValue="" className={inputCls}>
              <option value="">Select a timeline</option>
              {TIMELINES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Anything else" hint="Optional">
          <textarea name="message" rows={4} className={cn(inputCls, "resize-y")} />
        </Field>

        {/* Honeypot */}
        <input
          type="text"
          name="company_url"
          tabIndex={-1}
          autoComplete="off"
          value={honey}
          onChange={(e) => setHoney(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />

        {errors.form ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.form}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {state === "sending" ? "Sending…" : "Send enquiry"}
        </button>
        <p className="text-xs text-muted-foreground">
          No obligation. We reply within one working day.
        </p>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
