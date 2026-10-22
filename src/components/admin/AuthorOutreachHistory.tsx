import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const workflows = {
  awaiting_reply: "Awaiting reply",
  replied: "Replied",
  interested: "Interested",
  follow_up: "Follow up",
  closed: "Closed",
  opted_out: "Opted out",
};
type Workflow = keyof typeof workflows;
type Outreach = {
  id: string;
  recipient: string;
  subject: string;
  content: string;
  sender_name: string;
  source: "composer" | "resend_import";
  is_test: boolean;
  send_status: string;
  provider_id: string | null;
  delivery_status: string | null;
  checked_at: string | null;
  workflow: Workflow;
  notes: string;
  follow_up_on: string | null;
  created_at: string;
};
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const date = (value: string) => new Date(value).toLocaleString();
const label = (value: string) => value.replaceAll("_", " ");
export function AuthorOutreachHistory({ revision }: { revision: number }) {
  const [items, setItems] = useState<Outreach[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Outreach | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ search, workflow, kind, page: String(page) });
      fetch(`/api/admin/author-outreach?${query}`, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Could not load outreach history.");
          setItems(body.items);
          setTotal(body.total);
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setItems([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, workflow, kind, page, reload, revision]);
  async function update(action: "save" | "refresh", row: Outreach) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/author-outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "refresh"
            ? { action, id: row.id }
            : {
                id: row.id,
                workflow: row.workflow,
                notes: row.notes,
                followUpOn: row.follow_up_on || null,
              },
        ),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update outreach.");
      setNotice(action === "refresh" ? "Delivery status updated from Resend." : "Follow-up saved.");
      if (action === "save") setSelected(null);
      setReload((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update outreach.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Outreach history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved messages, delivery checks and your next steps.
          </p>
        </div>
        <button
          className="admin-button"
          disabled={loading || busy}
          onClick={() => setReload((x) => x + 1)}
        >
          Refresh history
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Search recipient
          <input
            className={`${field} mt-1`}
            placeholder="Author email address"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Follow-up status
          <select
            className={`${field} mt-1`}
            value={workflow}
            onChange={(e) => {
              setWorkflow(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(workflows).map(([value, title]) => (
              <option key={value} value={value}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Email type
          <select
            className={`${field} mt-1`}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
          >
            <option value="authors">Author outreach</option>
            <option value="tests">Test emails</option>
            <option value="all">All emails</option>
            <option value="imports">Imported emails (type unverified)</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="py-6 text-sm">
          Loading history…
        </p>
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {error
            ? "History could not be loaded."
            : "No outreach matches these filters. New sends will appear here automatically."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="p-3">Recipient / subject</th>
                <th className="p-3">Created</th>
                <th className="p-3">Delivery</th>
                <th className="p-3">Follow-up</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-border align-top">
                  <td className="p-3 min-w-56">
                    <p className="font-medium break-all">
                      {row.recipient}{" "}
                      {row.is_test && <span className="text-xs text-muted-foreground">· Test</span>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.subject}</p>
                  </td>
                  <td className="p-3 text-xs min-w-36">{date(row.created_at)}</td>
                  <td className="p-3 min-w-40">
                    <p className="capitalize">{label(row.delivery_status || row.send_status)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.checked_at
                        ? `Checked ${date(row.checked_at)}`
                        : "Not checked with Resend"}
                    </p>
                  </td>
                  <td className="p-3 min-w-36">
                    <p>{workflows[row.workflow]}</p>
                    {row.follow_up_on && <p className="mt-1 text-xs">Due {row.follow_up_on}</p>}
                  </td>
                  <td className="p-3 min-w-44">
                    <div className="flex flex-col gap-2">
                      <button
                        className="admin-button"
                        disabled={busy}
                        onClick={() => {
                          setSelected(row);
                          setNotice("");
                        }}
                      >
                        View / follow up
                      </button>
                      <button
                        className="admin-button"
                        disabled={busy || !row.provider_id}
                        onClick={() => void update("refresh", row)}
                      >
                        Check delivery
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {total} matching emails · Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
        </span>
        <div className="flex gap-2">
          <button
            className="admin-button"
            disabled={loading || page === 0}
            onClick={() => setPage((x) => x - 1)}
          >
            Previous
          </button>
          <button
            className="admin-button"
            disabled={loading || (page + 1) * 25 >= total}
            onClick={() => setPage((x) => x + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Accepted means submitted to Resend; delivered means accepted by the recipient’s mail server,
        not necessarily their inbox. Delivery checks are manual. Replies and follow-ups are recorded
        by you. Opt-outs, recorded bounces and complaints block future sends to that address.
      </p>
      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSelected(null);
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
          >
            <div className="flex justify-between gap-4">
              <DialogTitle className="pr-6">{selected.subject}</DialogTitle>
              <button
                autoFocus
                className="admin-button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <p className="text-sm break-all">
              To {selected.recipient} · {date(selected.created_at)}
            </p>
            <details>
              <summary className="cursor-pointer text-sm">View saved message</summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {selected.content}
                {"\n\n"}
                {selected.sender_name}
              </pre>
            </details>
            {selected.provider_id && (
              <p className="text-xs break-all text-muted-foreground">
                Resend reference: {selected.provider_id}
              </p>
            )}
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void update("save", selected);
              }}
            >
              <fieldset disabled={busy} className="space-y-4">
                <label className="block text-sm">
                  Follow-up status
                  <select
                    className={`${field} mt-1`}
                    value={selected.workflow}
                    onChange={(e) =>
                      setSelected({ ...selected, workflow: e.target.value as Workflow })
                    }
                  >
                    {Object.entries(workflows).map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Follow-up date
                  <input
                    type="date"
                    className={`${field} mt-1`}
                    value={selected.follow_up_on || ""}
                    onChange={(e) =>
                      setSelected({ ...selected, follow_up_on: e.target.value || null })
                    }
                  />
                </label>
                <label className="block text-sm">
                  Notes
                  <textarea
                    rows={4}
                    maxLength={5000}
                    className={`${field} mt-1`}
                    value={selected.notes}
                    onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
                    placeholder="Record replies, interests and your next action."
                  />
                </label>
                {selected.workflow === "opted_out" && (
                  <p className="text-sm">
                    This blocks future outreach to this address. Only change it if the author
                    explicitly agrees to receive emails again.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Saving a follow-up date does not schedule an email.
                </p>
                <button type="submit" className="admin-button">
                  {busy ? "Saving…" : "Save follow-up"}
                </button>
              </fieldset>
            </form>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
