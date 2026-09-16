import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { CAPABILITIES } from "@/data/capabilities";
import "./lead-popup.css";

const SESSION_KEY = "hq360-popup-shown";
const EXCLUDED_PATH_PREFIXES = ["/contact", "/admin", "/tools"];
const IDLE_DELAY_MS = 30_000;
const HELP_OPTIONS = CAPABILITIES.map((c) => c.name);

const schema = z.object({
  name: z.string().min(2, "Enter your name").max(160),
  email: z.string().email("Enter a valid email").max(320),
  helpWith: z.string().min(1, "Pick one"),
  message: z.string().max(4000).optional(),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>> & { form?: string };

/**
 * Site-wide lead-capture popup. Triggers once per browser session, on
 * whichever comes first: exit intent (desktop) or a 30s idle delay (covers
 * touch devices, where exit intent has no signal). Skipped on contact,
 * admin and tool pages, and while visitors are using a form or another dialog.
 */
export function LeadPopup() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [helpWith, setHelpWith] = useState("");
  const [emailed, setEmailed] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setOpen(false);
    if (EXCLUDED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return;
    }

    let fired = false;
    function trigger() {
      if (fired) return;
      if (
        document.visibilityState !== "visible" ||
        document.querySelector("dialog[open]") ||
        document.activeElement?.matches("input, textarea, select")
      )
        return;
      fired = true;
      setOpen(true);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      cleanup();
    }
    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) trigger();
    }
    const timer = window.setTimeout(trigger, IDLE_DELAY_MS);
    document.addEventListener("mouseleave", onMouseLeave);
    function cleanup() {
      window.clearTimeout(timer);
      document.removeEventListener("mouseleave", onMouseLeave);
    }
    return cleanup;
  }, [pathname]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [step, state, open]);

  useEffect(() => {
    if (state !== "done" || !open || !emailed) return;
    const timer = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(timer);
  }, [state, open, emailed]);

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    if (step === 0) {
      if (!helpWith) {
        setErrors({ helpWith: "Choose a service, or select Help me choose." });
        return;
      }
      setErrors({});
      setStep(1);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const candidate = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      helpWith,
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
          name: parsed.data.name,
          email: parsed.data.email,
          helpWith: [parsed.data.helpWith],
          message: parsed.data.message,
          sourcePath: window.location.pathname,
          company_url: String(fd.get("hp") ?? ""),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; emailed?: boolean };
      if (res.ok && body.ok) {
        setState("done");
        setEmailed(body.emailed === true);
      } else {
        setState("idle");
        setErrors({ form: "We could not send that. Try again, or email us directly." });
      }
    } catch {
      setState("idle");
      setErrors({ form: "Network error. Try again, or email us directly." });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="lead-popup"
      aria-label="Start a project with HQ360"
      onClose={close}
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
    >
      <div className="lead-popup-shell">
        <button type="button" onClick={close} className="lead-popup-close" aria-label="Close">
          <X aria-hidden="true" />
        </button>

        {state === "done" ? (
          <div className="lead-popup-done" role="status">
            <CheckCircle2 size={44} className="text-brand" aria-hidden="true" />
            <h3 ref={headingRef} tabIndex={-1}>
              Your next move is in motion.
            </h3>
            <p>
              {emailed
                ? "Your enquiry has been emailed to HQ360. Our team will reply within one working day."
                : "Your enquiry has been saved. Email notification is delayed; for urgent requests, email ceo@hq360.space."}
            </p>
            <button type="button" className="lead-popup-submit" onClick={close}>
              Back to exploring <ArrowRight size={16} />
            </button>
            {emailed ? (
              <p className="lead-popup-fine">This window will close shortly.</p>
            ) : (
              <a href="mailto:ceo@hq360.space" className="text-sm text-brand underline">
                Email HQ360
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="lead-popup-intro">
              <span className="lead-popup-icon">
                <Sparkles size={21} />
              </span>
              <p className="lead-popup-eyebrow">Let’s build your next chapter</p>
            </div>
            <div className="lead-popup-progress" aria-label={`Step ${step + 1} of 2`}>
              <span data-active="true" />
              <span data-active={step === 1} />
            </div>
            <h3 ref={headingRef} tabIndex={-1} className="lead-popup-title">
              {step === 0 ? "What would you like to grow?" : "Let’s make it happen."}
            </h3>
            <p className="lead-popup-lede">
              {step === 0
                ? "A new idea, a better website, your next big launch. Tell us where you want to start."
                : "Just your details, and we’ll take it from here. No obligation."}
            </p>

            <form onSubmit={onSubmit} noValidate className="lead-popup-form">
              <div hidden={step !== 0}>
                <fieldset className="lead-popup-choices">
                  <legend className="sr-only">Choose a service</legend>
                  {[...HELP_OPTIONS, "Help me choose"].map((option) => (
                    <label key={option} className="lead-popup-choice">
                      <input
                        type="radio"
                        name="serviceChoice"
                        value={option}
                        checked={helpWith === option}
                        onChange={() => {
                          setHelpWith(option);
                          setErrors({});
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
                {errors.helpWith ? (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {errors.helpWith}
                  </p>
                ) : null}
              </div>
              <div hidden={step !== 1} className="lead-popup-details">
                <div className="lead-popup-selection">
                  <span>{helpWith}</span>
                  <button type="button" disabled={state === "sending"} onClick={() => setStep(0)}>
                    Change
                  </button>
                </div>
                <div className="lead-popup-row">
                  <Field label="Full name" error={errors.name}>
                    <input
                      name="name"
                      type="text"
                      maxLength={160}
                      autoComplete="name"
                      placeholder="Your name"
                      aria-invalid={Boolean(errors.name)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <input
                      name="email"
                      type="email"
                      maxLength={320}
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={Boolean(errors.email)}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Anything else" hint="Optional">
                  <textarea
                    name="message"
                    rows={3}
                    maxLength={4000}
                    placeholder={
                      helpWith === "Help me choose"
                        ? "What would you like to achieve?"
                        : `Tell us a little about your ${helpWith.toLowerCase()} project…`
                    }
                    className={`${inputCls} resize-y`}
                  />
                </Field>
              </div>
              <input
                name="hp"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              {errors.form ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.form}
                </p>
              ) : null}

              <div className="lead-popup-actions">
                {step === 1 ? (
                  <button
                    type="button"
                    className="lead-popup-back"
                    disabled={state === "sending"}
                    onClick={() => setStep(0)}
                    aria-label="Back to services"
                  >
                    <ArrowLeft size={18} />
                  </button>
                ) : null}
                <button type="submit" disabled={state === "sending"} className="lead-popup-submit">
                  {state === "sending"
                    ? "Sending your enquiry…"
                    : step === 0
                      ? "Continue"
                      : "Send my enquiry"}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
              <p className="lead-popup-fine">
                {step === 0
                  ? "Step 1 of 2 · A quick conversation starts here"
                  : "Your details are only used to respond to your enquiry."}
              </p>
            </form>
          </>
        )}
      </div>
    </dialog>
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
