import { useEffect, useRef, useState } from "react";
import { AuthorOutreachHistory } from "./AuthorOutreachHistory";
import { Mail, Send } from "lucide-react";
import {
  authorEmailSchema,
  buildAuthorEmail,
  exampleContent,
  exampleSubject,
} from "@/lib/author-email";

const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";
type Config = { ready: boolean; from: string; replyTo: string };
export function AuthorOutreach() {
  const [historyRevision, setHistoryRevision] = useState(0);
  const [view, setView] = useState<"compose" | "history">("compose");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(exampleSubject);
  const [content, setContent] = useState(exampleContent);
  const [senderName, setSenderName] = useState("Racheal Eniola");
  const [testTo, setTestTo] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const attempts = useRef(new Map<string, { id: string; accepted: boolean }>());
  const sending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/author-email", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load email settings. Refresh to try again.");
        setConfig(await response.json());
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const draft = { subject, content, senderName };
  const email = buildAuthorEmail(draft);
  function change(update: () => void) {
    update();
    setReview(false);
    setMessage("");
    setError("");
  }
  async function send(test: boolean) {
    if (sending.current) return;
    const payload = { ...draft, to: test ? testTo : to, isTest: test };
    const key = JSON.stringify(payload);
    const attempt = attempts.current.get(key) || { id: crypto.randomUUID(), accepted: false };
    if (attempt.accepted) {
      setError(
        "This exact email was already accepted in this session. Change the message before sending again.",
      );
      return;
    }
    const parsed = authorEmailSchema.safeParse({ ...payload, requestId: attempt.id });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check the fields.");
      return;
    }
    attempts.current.set(key, attempt);
    sending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/author-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok || !result.accepted)
        throw new Error(
          result.error || "Sending was not confirmed. Retry the unchanged email safely.",
        );
      attempt.accepted = true;
      setMessage(
        `${result.duplicate ? "Previously sent email" : test ? "Test email" : "Email"} accepted by Resend for ${payload.to}.${result.id ? ` Reference: ${result.id}.` : ""} Acceptance does not confirm inbox delivery.${result.warning ? ` ${result.warning}` : ""}`,
      );
      setReview(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sending was not confirmed. Retry the unchanged email safely.",
      );
    } finally {
      setHistoryRevision((x) => x + 1);
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          className="admin-button"
          aria-pressed={view === "compose"}
          onClick={() => setView("compose")}
        >
          Compose email
        </button>
        <button
          className="admin-button"
          aria-pressed={view === "history"}
          onClick={() => setView("history")}
        >
          Outreach history
        </button>
      </div>
      <div hidden={view !== "history"}>
        {view === "history" && <AuthorOutreachHistory revision={historyRevision} />}
      </div>
      <div hidden={view !== "compose"} className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Mail size={20} /> A personal introduction, beautifully presented
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Write to one author at a time. Add their address, personalize the example and preview
            the exact email before sending.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            From: {config?.from || "Loading…"} · Replies: {config?.replyTo || "Not configured"}
          </p>
          {config && !config.ready && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Sending is unavailable. Set EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM and
              AUTHOR_EMAIL_REPLY_TO on the server.
            </p>
          )}
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <form
            className="rounded-2xl border border-border bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              setReview(true);
            }}
          >
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
              <label className="block text-sm font-medium">
                Author email
                <input
                  type="email"
                  required
                  maxLength={254}
                  className={field}
                  value={to}
                  onChange={(e) => change(() => setTo(e.target.value))}
                  placeholder="author@example.com"
                />
              </label>
              <label className="block text-sm font-medium">
                Subject
                <input
                  required
                  maxLength={200}
                  className={field}
                  value={subject}
                  onChange={(e) => change(() => setSubject(e.target.value))}
                />
              </label>
              <label className="block text-sm font-medium">
                Email content
                <textarea
                  required
                  maxLength={20000}
                  rows={18}
                  className={`${field} resize-y leading-relaxed`}
                  value={content}
                  onChange={(e) => change(() => setContent(e.target.value))}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Separate paragraphs with a blank line. Use **bold headings** for service sections.
                  Your signature is added below.
                </span>
              </label>
              <label className="block text-sm font-medium">
                Signature name
                <input
                  required
                  maxLength={100}
                  className={field}
                  value={senderName}
                  onChange={(e) => change(() => setSenderName(e.target.value))}
                />
              </label>
              <div className="rounded-xl bg-secondary/50 p-4">
                <label className="block text-sm font-medium">
                  Send a test to your inbox
                  <input
                    type="email"
                    className={field}
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="you@hq360.space"
                  />
                </label>
                <button
                  type="button"
                  className="admin-button mt-3"
                  disabled={!config?.ready || !testTo.trim()}
                  onClick={() => void send(true)}
                >
                  Send test email
                </button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Only contact authors who welcome relevant outreach. Check previous replies before
                sending and honor every STOP request. This tool does not monitor replies.
              </p>
              {!review ? (
                <button type="submit" className="admin-button" disabled={!config?.ready}>
                  <Send size={16} /> Review email
                </button>
              ) : (
                <div className="rounded-xl border border-primary/30 p-4 space-y-3">
                  <p className="text-sm">
                    Send <strong>{subject}</strong> to <strong>{to}</strong>?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirm that the preview and recipient are correct and this author has not opted
                    out.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="admin-button" onClick={() => void send(false)}>
                      Send to author
                    </button>
                    <button type="button" className="admin-button" onClick={() => setReview(false)}>
                      Keep editing
                    </button>
                  </div>
                </div>
              )}
            </fieldset>
            {busy && (
              <p role="status" className="mt-3 text-sm">
                Submitting to Resend…
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">
                {message}
              </p>
            )}
          </form>
          <section className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Live email preview</h3>
              <button className="admin-button" onClick={() => setMobile(!mobile)}>
                {mobile ? "Desktop width" : "Mobile width"}
              </button>
            </div>
            <p className="mb-3 break-words text-xs text-muted-foreground">Subject: {subject}</p>
            <iframe
              title="Author outreach email preview"
              sandbox=""
              srcDoc={email.html}
              className="mx-auto h-[900px] w-full rounded-xl border border-border bg-white"
              style={{ maxWidth: mobile ? 375 : "100%" }}
            />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer">Plain-text version</summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                {email.text}
              </pre>
            </details>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Inbox placement cannot be guaranteed. Authenticate your sending domain with SPF, DKIM
              and DMARC, disable open/click tracking in Resend, and check bounces and complaints in
              its dashboard.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
