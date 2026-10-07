import { authorMailto } from "@/lib/scout/outreach";
import { useEffect, useState } from "react";
const endpoint = "/api/admin/scout-outreach";
const field = "w-full rounded-lg border border-border bg-background p-3 text-sm";
async function post(body: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Message request failed.");
  return data;
}
export function OutreachSettings() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load prompt.");
        setPrompt(data.prompt);
        setLoaded(true);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      });
    return () => controller.abort();
  }, []);
  return (
    <details className="mx-auto my-4 max-w-6xl rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-semibold">Personalized message settings</summary>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await post({ action: "save_prompt", prompt });
            setMessage("Prompt saved for your workspace. New drafts will use it.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not save prompt.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          Your writing prompt
          <textarea
            aria-label="Outreach writing prompt"
            className={`${field} mt-2`}
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            maxLength={6000}
            disabled={!loaded || busy}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Explain your offer, tone and call to action. GPT-6 Luna personalizes each draft using the
          author and book details. Review the result before reaching out.
        </p>
        <button
          disabled={!loaded || busy || !prompt.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save prompt"}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
export function AuthorOutreach({
  authorId,
  bookId,
  emails,
}: {
  authorId: string;
  bookId: string;
  emails: string[];
}) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState(emails[0] || "");
  const [draft, setDraft] = useState<{
    id: string;
    recipient: string;
    subject: string;
    body: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || !recipient) return;
    let active = true;
    setBusy(true);
    void post({ action: "load", authorId, bookId, recipient })
      .then((data) => {
        if (active) setDraft(data.draft);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, recipient, authorId, bookId]);
  return (
    <div className="mt-3 space-y-3 text-sm">
      <button onClick={() => setOpen(!open)} className="rounded-lg border border-border px-3 py-2">
        {open ? "Close message" : "Write personalized message"}
      </button>
      {open && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="block">
            Recipient
            <select
              aria-label="Message recipient"
              className={field}
              value={recipient}
              disabled={busy}
              onChange={(e) => {
                setRecipient(e.target.value);
                setDraft(null);
              }}
            >
              {emails.map((email) => (
                <option key={email}>{email}</option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !recipient}
            className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const data = await post({ action: "draft", authorId, bookId, recipient });
                setDraft(data.draft);
              } catch (error) {
                setError(error instanceof Error ? error.message : "Could not draft message.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Writing…" : draft ? "Generate another draft" : "Generate draft"}
          </button>
          {draft && (
            <>
              <label className="block">
                Subject
                <input
                  aria-label="Email subject"
                  className={field}
                  value={draft.subject}
                  maxLength={160}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </label>
              <label className="block">
                Message
                <textarea
                  aria-label="Email message"
                  className={field}
                  rows={9}
                  maxLength={6000}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
              <button
                className="rounded-lg border px-3 py-2"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(`Subject: ${draft.subject}\n\n${draft.body}`)
                    .then(
                      () => setError("Message copied."),
                      () => setError("Copy failed. Select the message text to copy it."),
                    )
                }
              >
                Copy message
              </button>
              <a
                className="ml-2 inline-block rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                href={authorMailto(draft.recipient, draft.subject, draft.body)}
              >
                Open in email app
              </a>
              <button
                disabled={busy}
                className="ml-2 rounded-lg border px-3 py-2 disabled:opacity-50"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await post({
                      action: "save_draft",
                      id: draft.id,
                      subject: draft.subject,
                      body: draft.body,
                    });
                    setError("Draft saved.");
                  } catch (error) {
                    setError(error instanceof Error ? error.message : "Could not save draft.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save edits
              </button>
              <p className="text-xs text-muted-foreground">
                Opens your default email app with this draft. Add your signature and send there. If
                your app truncates a long message, use Copy message. Nothing is sent automatically.
              </p>
            </>
          )}
          {error && <p role="status">{error}</p>}
        </div>
      )}
    </div>
  );
}
