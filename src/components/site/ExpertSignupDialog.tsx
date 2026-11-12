import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, X } from "lucide-react";

export function ExpertSignupDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const open = () => dialogRef.current?.showModal();
    const openFromHash = () => {
      if (window.location.hash === "#become-expert") open();
    };
    const intercept = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href="/expert-signup"]',
      );
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("click", intercept);
    window.addEventListener("open-expert-signup", open);
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    return () => {
      document.removeEventListener("click", intercept);
      window.removeEventListener("open-expert-signup", open);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/expert/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: String(form.get("full_name") || "").trim(),
        headline: String(form.get("headline") || "").trim(),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setSubmitting(false);
    if (!response?.ok) return setError(body?.error || "Could not submit your application.");
    setDone(true);
  }

  return (
    <dialog ref={dialogRef} className="expert-signup-dialog" aria-labelledby="expert-signup-title">
      <button
        className="expert-signup-dialog__close"
        aria-label="Close application"
        onClick={() => {
          dialogRef.current?.close();
          if (location.hash === "#become-expert")
            history.replaceState(null, "", location.pathname + location.search);
        }}
      >
        <X aria-hidden="true" />
      </button>
      {done ? (
        <div className="expert-signup-dialog__success">
          <CheckCircle2 aria-hidden="true" />
          <h2 id="expert-signup-title">Application received.</h2>
          <p>We’ll review your details before activating your expert account.</p>
          <button onClick={() => dialogRef.current?.close()}>Done</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="expert-signup-dialog__eyebrow">Join the HQ360 expert network</p>
          <h2 id="expert-signup-title">Become an Expert</h2>
          <p>
            Tell us who you are and what you do. Applications are reviewed before access is granted.
          </p>
          <label>
            Full name
            <input name="full_name" required minLength={2} maxLength={150} autoComplete="name" />
          </label>
          <label>
            Your expertise
            <input
              name="headline"
              required
              minLength={3}
              maxLength={160}
              placeholder="e.g. Web designer & developer"
            />
          </label>
          <label>
            Email
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error ? (
            <p className="expert-signup-dialog__error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Apply to become an Expert"}
          </button>
          <small>
            Already approved? <a href="/expert">Sign in to your workspace</a>
          </small>
        </form>
      )}
    </dialog>
  );
}
