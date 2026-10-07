import { useState } from "react";

type Contact = { email: string; role: string; source_url: string; evidence: string };
export function AuthorContactSearch({ authorId, bookId }: { authorId: string; bookId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [retryAt, setRetryAt] = useState(0);
  async function search() {
    if (Date.now() < retryAt) {
      setError(`Please retry in ${Math.ceil((retryAt - Date.now()) / 1000)} seconds.`);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setContacts([]);
    try {
      const response = await fetch(`/api/admin/scout-authors/${authorId}/find-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const result = await response.json();
      if (response.status === 429)
        setRetryAt(Date.now() + Number(response.headers.get("retry-after") || 1) * 1000);
      if (!response.ok) throw new Error(result.message || "Could not find author contacts.");
      setContacts(result.contacts ?? []);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Contact search failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border p-3 text-sm">
      <button
        type="button"
        onClick={() => void search()}
        disabled={busy}
        className="rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-50"
      >
        {busy ? "Searching public contact sources…" : "Find author email"}
      </button>
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Checking this author and book across websites and public pages. This can take up to 90
          seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {contacts.map((contact) => (
        <div key={contact.email} className="space-y-1 break-words">
          <p className="font-medium">
            {contact.email}{" "}
            <span className="font-normal text-muted-foreground">· {contact.role} · unverified</span>
          </p>
          <p className="text-xs text-muted-foreground">{contact.evidence}</p>
          <a
            href={contact.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-brand underline"
          >
            Review source ↗
          </a>
        </div>
      ))}
    </div>
  );
}
