import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { CAPABILITIES } from "@/data/capabilities";
import { openBlankLeadTab, navigateLeadTab } from "@/lib/lead-mailto";
import "./lead-popup.css";

const SESSION_KEY = "hq360-popup-shown";
const EXCLUDED_PATH_PREFIXES = ["/contact", "/admin"];
const IDLE_DELAY_MS = 30_000;
const HELP_OPTIONS = CAPABILITIES.map((c) => c.name);

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  helpWith: z.string().min(1, "Pick one"),
  message: z.string().optional(),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>> & { form?: string };

/**
 * Site-wide lead-capture popup. Triggers once per browser session, on
 * whichever comes first: exit intent (desktop) or a 30s idle delay (covers
 * touch devices, where exit intent has no signal). Skipped on /contact
 * (already the full form) and /admin.
 */
export function LeadPopup() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (EXCLUDED_PATH_PREFIXES.some((p) => window.location.pathname.startsWith(p))) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return;
    }

    let fired = false;
    function trigger() {
      if (fired) return;
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
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const fd = new FormData(e.currentTarget);
    const candidate = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      helpWith: String(fd.get("helpWith") ?? "").trim(),
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
    const mailTab = openBlankLeadTab();

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
          company_url: "",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && body.ok) {
        setState("done");
        navigateLeadTab(mailTab, {
          subject: `New HQ360 inquiry from ${parsed.data.name}`,
          body: [
            `Name: ${parsed.data.name}`,
            `Email: ${parsed.data.email}`,
            `Need help with: ${parsed.data.helpWith}`,
            `Source page: ${window.location.pathname}`,
            "",
            `Message: ${parsed.data.message || "N/A"}`,
          ].join("\n"),
        });
        window.setTimeout(close, 2600);
      } else {
        mailTab?.close();
        setState("idle");
        setErrors({ form: "We could not send that. Try again, or email us directly." });
      }
    } catch {
      mailTab?.close();
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
            <h3>Thanks — that's in.</h3>
            <p>We read every enquiry ourselves and reply within one working day.</p>
          </div>
        ) : (
          <>
            <p className="lead-popup-eyebrow">Before you go</p>
            <h3 className="lead-popup-title">Want a first view of what we'd do?</h3>
            <p className="lead-popup-lede">
              Two-minute form. No obligation. We reply within one working day.
            </p>

            <form onSubmit={onSubmit} noValidate className="lead-popup-form">
              <div className="lead-popup-row">
                <Field label="Full name" error={errors.name}>
                  <input name="name" type="text" autoComplete="name" className={inputCls} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input name="email" type="email" autoComplete="email" className={inputCls} />
                </Field>
              </div>

              <Field label="What do you need help with?" error={errors.helpWith}>
                <select name="helpWith" defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Select one
                  </option>
                  {HELP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Anything else" hint="Optional">
                <textarea name="message" rows={2} className={`${inputCls} resize-none`} />
              </Field>

              {errors.form ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.form}
                </p>
              ) : null}

              <button type="submit" disabled={state === "sending"} className="lead-popup-submit">
                {state === "sending" ? "Sending…" : "Send enquiry"}
              </button>
              <p className="lead-popup-fine">No spam. We only use this to reply to you.</p>
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
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
