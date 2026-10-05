import { trackConversion } from "@/lib/google-analytics";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { AUDIENCES, CORE_SERVICES } from "@/data/agency";
import { inquirySourcePath } from "@/lib/inquiry-context";

const HELP_OPTIONS = CORE_SERVICES.map((c) => c.name);
const BUDGETS = ["Not sure yet", "Under $5k", "$5k – $15k", "$15k – $50k", "$50k+"];
const TIMELINES = ["As soon as possible", "Within 1–3 months", "In 3–6 months", "Just exploring"];

type Candidate = {
  name: string;
  email: string;
  company: string;
  website: string;
  industry: string;
  helpWith: string[];
  primaryGoal: string;
  budgetRange: string;
  timeline: string;
  message: string;
};

// Hand-written checks (same messages as before) instead of zod: this form is
// on most marketing pages, and zod would ship to every visitor. The API
// validates the full payload again on the server.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validate(c: Candidate): Partial<Record<keyof Candidate, string>> {
  const errors: Partial<Record<keyof Candidate, string>> = {};
  if (c.name.length < 2 || c.name.length > 160) errors.name = "Enter your name";
  if (!EMAIL.test(c.email) || c.email.length > 320) errors.email = "Enter a valid email";
  if (c.helpWith.length < 1) errors.helpWith = "Pick at least one area";
  return errors;
}

type Errors = Partial<Record<keyof Candidate, string>> & { form?: string };

export function ProjectInquiryForm({
  defaultIndustry,
  sourceIndustry,
  sourceService = "",
  sourcePath,
  defaultServices = [],
  className,
  compact = false,
  helpOptions = HELP_OPTIONS,
}: {
  /** Prefill the industry select (Industry.shortName). */
  defaultIndustry?: string | undefined;
  /** The industry landing page this form was rendered on. */
  sourceIndustry?: string | undefined;
  sourceService?: string | undefined;
  sourcePath?: string | undefined;
  defaultServices?: string[];
  className?: string;
  compact?: boolean;
  /** Optional vertical-specific service choices. */
  helpOptions?: string[];
}) {
  const [helpWith, setHelpWith] = useState<string[]>(defaultServices);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [honey, setHoney] = useState("");
  const [emailed, setEmailed] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const fd = new FormData(e.currentTarget);
    const candidate: Candidate = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      website: String(fd.get("website") ?? "").trim(),
      industry: String(fd.get("industry") ?? "").trim(),
      helpWith: helpWith.length ? helpWith : ["Help me choose"],
      primaryGoal: String(fd.get("primaryGoal") ?? "").trim(),
      budgetRange: String(fd.get("budgetRange") ?? "").trim(),
      timeline: String(fd.get("timeline") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
    };

    const found = validate(candidate);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      setErrors(found);
      const field = e.currentTarget.elements.namedItem(firstInvalid);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    setErrors({});
    setState("sending");

    try {
      const res = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...candidate,
          sourceIndustry: sourceIndustry ?? "",
          sourcePath: inquirySourcePath(
            sourcePath ?? (typeof window !== "undefined" ? window.location.pathname : ""),
            sourceService,
          ),
          company_url: honey,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; emailed?: boolean };
      if (res.ok && body.ok) {
        setEmailed(body.emailed === true);
        if (!honey) trackConversion("project_inquiry_submitted");
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
          {emailed
            ? "Your enquiry has been emailed to HQ360. We will reply within one working day."
            : "Your enquiry has been saved. Email notification is delayed; for urgent requests, contact ceo@hq360.space."}
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
            <input
              name="name"
              required
              maxLength={160}
              type="text"
              autoComplete="name"
              className={inputCls}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              name="email"
              required
              maxLength={320}
              type="email"
              autoComplete="email"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Business type" hint="Optional">
          <select name="industry" defaultValue={defaultIndustry ?? ""} className={inputCls}>
            <option value="">Choose your business type</option>
            {[
              ...new Set([
                ...AUDIENCES.map((a) => a.name),
                ...(defaultIndustry ? [defaultIndustry] : []),
              ]),
            ].map((name) => (
              <option key={name}>{name}</option>
            ))}
            <option>Other</option>
          </select>
        </Field>
        <fieldset>
          <legend className="text-sm font-medium">What do you need help with?</legend>
          <p className="mt-1 text-sm text-muted-foreground">
            Select all that apply, or leave this blank and we’ll help you choose.
          </p>
          <div className="mt-3 grid gap-2">
            {[...new Set([...helpOptions, ...defaultServices])].map((option) => (
              <label
                key={option}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={helpWith.includes(option)}
                  onChange={(event) =>
                    setHelpWith((current) =>
                      event.target.checked
                        ? [...current, option]
                        : current.filter((value) => value !== option),
                    )
                  }
                  className="size-4 accent-brand"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Tell us a little about your idea" hint="Optional">
          <textarea
            name="message"
            rows={3}
            maxLength={4000}
            placeholder="What would you like to achieve?"
            className={cn(inputCls, "resize-y")}
          />
        </Field>
        <details className="rounded-xl border border-border p-4 text-foreground">
          <summary className="cursor-pointer text-sm font-medium">
            Add project details{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Website">
              <input
                name="website"
                maxLength={300}
                placeholder="yourbusiness.com"
                className={inputCls}
              />
            </Field>
            <Field label="Budget">
              <select name="budgetRange" className={inputCls}>
                <option value="">Not decided yet</option>
                {BUDGETS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Timeline">
              <select name="timeline" className={inputCls}>
                <option value="">Choose timing</option>
                {TIMELINES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
        </details>

        {/* Honeypot — deliberately not named "company"/"url"/"website" etc,
            since those are exactly what autofill/password-manager
            extensions target even on a hidden field with
            autocomplete="off". */}
        <input
          type="text"
          name="hp"
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
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}
