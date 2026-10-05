import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Search } from "lucide-react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { canonicalUrl } from "@/lib/scout/normalize";
import type {
  AudienceBatch,
  AudienceLead,
  AudienceSource,
  ScoutAudience,
} from "@/lib/scout/audiences";
const field =
  "mt-2 w-full min-w-0 rounded-xl border border-border bg-background px-4 py-3 text-sm disabled:opacity-50";
const button = "rounded-xl border border-border px-4 py-2.5 text-sm disabled:opacity-50";
async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(55000)])
      : AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false)
    throw new Error(
      data.message ||
        (response.status === 401
          ? "Your session expired. Sign in again."
          : "Scouting could not complete this request."),
    );
  return data;
}
function Link({ url, children }: { url: string | null; children: React.ReactNode }) {
  const safe = canonicalUrl(url ?? undefined);
  return safe ? (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  ) : null;
}
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function AudienceScout({
  audience,
  onBusyChange,
}: {
  audience: ScoutAudience;
  onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<AudienceSource>(audience.source);
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [batches, setBatches] = useState<AudienceBatch[]>([]);
  const [selected, setSelected] = useState("");
  const [leads, setLeads] = useState<AudienceLead[]>([]);
  const [filter, setFilter] = useState("all");
  const [batchSource, setBatchSource] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0, found: 0, failed: 0 });
  const lifetime = useRef<AbortController | null>(null);
  const emailController = useRef<AbortController | null>(null);
  const retryRequest = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    onBusyChange(Boolean(busy));
  }, [busy, onBusyChange]);
  useEffect(() => {
    lifetime.current = new AbortController();
    return () => {
      lifetime.current?.abort();
      emailController.current?.abort();
      onBusyChange(false);
    };
  }, [onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<{ items: AudienceBatch[] }>(
      `/api/admin/scout-audience-batches?audience=${audience.id}`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setBatches(data.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [audience.id, refresh]);
  useEffect(() => {
    setLeads([]);
    setDetailError("");
    setFilter("all");
    if (!selected) return;
    const controller = new AbortController();
    setDetailLoading(true);
    request<{ items: AudienceLead[] }>(
      `/api/admin/scout-audience-batches/${selected}`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setLeads(data.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setDetailError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected, refresh]);
  async function search() {
    setBusy("search");
    setError("");
    setNotice("");
    const body = { audience: audience.id, source, niche, location, limit, page };
    const key = JSON.stringify(body);
    if (retryRequest.current?.key !== key) retryRequest.current = { key, id: crypto.randomUUID() };
    try {
      const data = await request<{ batch: AudienceBatch }>(
        "/api/admin/scout-audience-batches",
        { ...body, requestId: retryRequest.current.id },
        lifetime.current?.signal,
      );
      setBatches((current) => [
        data.batch,
        ...current.filter((batch) => batch.id !== data.batch.id),
      ]);
      setBatchSource("all");
      setSelected(data.batch.id);
      retryRequest.current = null;
      setNotice(
        `${data.batch.item_count} results saved to this batch. Review each source to confirm audience fit.`,
      );
    } catch (e) {
      if (!lifetime.current?.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function updateLead(
    lead: AudienceLead,
    action: "find-email" | "verify-email" | "shortlist",
    signal?: AbortSignal,
  ) {
    const data = await request<{ item: AudienceLead; message?: string }>(
      `/api/admin/scout-audience-leads/${lead.id}`,
      { action },
      signal ?? lifetime.current?.signal,
    );
    if (!signal?.aborted) {
      setLeads((current) => current.map((item) => (item.id === lead.id ? data.item : item)));
      setMessages((current) => ({
        ...current,
        [lead.id]:
          data.message ??
          (action === "verify-email"
            ? "Email verified."
            : action === "shortlist"
              ? "Added to shortlist."
              : "Email found. Review the evidence before verifying."),
      }));
    }
    return data.item;
  }
  async function act(lead: AudienceLead, action: "find-email" | "verify-email" | "shortlist") {
    setBusy(lead.id);
    setError("");
    try {
      await updateLead(lead, action);
    } catch (e) {
      setMessages((current) => ({ ...current, [lead.id]: (e as Error).message }));
    } finally {
      setBusy("");
    }
  }
  async function findEmails() {
    const controller = new AbortController();
    emailController.current = controller;
    const pending = leads.filter((lead) => !lead.contact_email);
    const summary = {
      done: leads.length - pending.length,
      total: leads.length,
      found: leads.length - pending.length,
      failed: 0,
    };
    setProgress({ ...summary });
    setBusy("emails");
    setNotice("");
    let next = 0;
    async function worker() {
      while (!controller.signal.aborted && next < pending.length) {
        const lead = pending[next++]!;
        try {
          const item = await updateLead(lead, "find-email", controller.signal);
          if (controller.signal.aborted) return;
          if (item.contact_email) summary.found++;
        } catch (e) {
          if (controller.signal.aborted) return;
          summary.failed++;
          setMessages((current) => ({
            ...current,
            [lead.id]: `Search failed: ${(e as Error).message}`,
          }));
        }
        summary.done++;
        setProgress({ ...summary });
      }
    }
    await Promise.all([worker(), worker()]);
    setNotice(
      `${controller.signal.aborted ? "Stopped. " : ""}${summary.done} of ${summary.total} leads checked · ${summary.found} emails available · ${summary.failed} failed. Run again to retry missing emails.`,
    );
    emailController.current = null;
    setBusy("");
  }
  const batch = batches.find((item) => item.id === selected);
  const visible = leads.filter(
    (lead) =>
      filter === "all" ||
      (filter === "email"
        ? Boolean(lead.contact_email)
        : filter === "missing"
          ? !lead.contact_email
          : lead.shortlisted),
  );
  function exportCsv() {
    const rows = [
      [
        "Name",
        "Audience",
        "Source",
        "Category",
        "Address",
        "Phone",
        "Website",
        "Description",
        "Rating",
        "Review count",
        "Email",
        "Email status",
        "Email evidence",
        "Shortlisted",
        "Source URL",
      ],
      ...visible.map((lead) => [
        lead.name,
        audience.label,
        lead.source,
        lead.category,
        lead.address,
        lead.phone,
        lead.website_url,
        lead.description,
        lead.rating,
        lead.review_count,
        lead.contact_email,
        lead.contact_email ? lead.contact_status : "",
        lead.contact_source_url,
        lead.shortlisted ? "Yes" : "No",
        lead.source_url,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `hq360-${audience.id}-${selected}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="rounded-3xl border border-border bg-secondary/40 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          HQ360 · Scouting workspace
        </p>
        <h1 className="mt-3 font-display text-3xl">{audience.label} scouting</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Find prospects through Google Maps or web search. Each search becomes a batch you can
          review, shortlist and export.
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold">Start a search</h2>
        <fieldset
          disabled={Boolean(busy)}
          className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm font-medium">
            Search source
            <select
              aria-label="Search source"
              className={field}
              value={source}
              onChange={(event) => {
                setSource(event.target.value as AudienceSource);
                setPage(1);
              }}
            >
              <option value="maps">Google Maps</option>
              <option value="web">Web search</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Niche or keywords
            <input
              className={field}
              required
              minLength={2}
              maxLength={120}
              value={niche}
              onChange={(event) => {
                setNiche(event.target.value);
                setPage(1);
              }}
              placeholder={
                audience.source === "maps"
                  ? "e.g. residential cleaning"
                  : "e.g. beauty, fitness, brand strategy"
              }
            />
          </label>
          <label className="text-sm font-medium">
            Location {source === "web" && "(optional)"}
            <input
              className={field}
              required={source === "maps"}
              minLength={source === "maps" ? 2 : undefined}
              maxLength={120}
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
              placeholder="City, region or country"
            />
          </label>
          <label className="text-sm font-medium">
            Results per batch
            <select
              className={field}
              aria-label="Results per batch"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>Up to 10</option>
              <option value={20}>Up to 20</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Results page
            <select
              className={field}
              aria-label="Results page"
              value={page}
              onChange={(event) => setPage(Number(event.target.value))}
            >
              {Array.from({ length: 10 }, (_, index) => (
                <option key={index} value={index + 1}>
                  Page {index + 1}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <button
          disabled={Boolean(busy)}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Search className="size-4" />
          {busy === "search" ? "Searching and saving…" : "Search & create batch"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          {source === "maps"
            ? "Maps may return a website, address, phone, rating and review count. Availability varies by listing."
            : "Web results include indexed page titles and descriptions. A matching page is a lead to review, not a verified business identity."}
        </p>
      </form>
      {busy === "search" && (
        <GlassLoading
          label={`Searching ${source === "maps" ? "Google Maps" : "the web"} and saving your batch…`}
          cards
        />
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}{" "}
          <button
            disabled={Boolean(busy)}
            className="ml-2 underline"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Reload batches
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-secondary p-4 text-sm">
          {notice}
        </p>
      )}
      <section aria-label="Batch" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Batch</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved searches for {audience.label.toLowerCase()}.
            </p>
          </div>
          <label className="text-sm">
            Filter batches
            <select
              className={field}
              aria-label="Filter batches"
              value={batchSource}
              disabled={Boolean(busy)}
              onChange={(event) => {
                setBatchSource(event.target.value);
                setSelected("");
              }}
            >
              <option value="all">All sources</option>
              <option value="maps">Google Maps</option>
              <option value="web">Web search</option>
            </select>
          </label>
        </div>
        {loading ? (
          <GlassLoading label="Loading audience batches…" variant="list" rows={4} />
        ) : (
          <label className="block text-sm font-medium">
            Choose a batch
            <select
              className={field}
              aria-label="Choose a batch"
              disabled={Boolean(busy)}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">
                {batches.length ? "Select a saved search" : "No batches yet — start a search"}
              </option>
              {batches
                .filter((item) => batchSource === "all" || item.source === batchSource)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} · {new Date(item.created_at).toLocaleString()} · {item.item_count}{" "}
                    leads
                  </option>
                ))}
            </select>
          </label>
        )}
      </section>
      {selected && (
        <section aria-label="Batch details" className="space-y-4 border-t border-border pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{batch?.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {visible.length} of {leads.length} leads
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Filter leads
                <select
                  className={field}
                  aria-label="Filter leads"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All leads</option>
                  <option value="email">Has email</option>
                  <option value="missing">Email missing</option>
                  <option value="shortlisted">Shortlisted</option>
                </select>
              </label>
              <button
                className={button}
                disabled={!visible.length || detailLoading}
                onClick={exportCsv}
              >
                <Download className="mr-2 inline size-4" />
                Export CSV
              </button>
              <button
                className={button}
                disabled={Boolean(busy) || detailLoading || !leads.length}
                onClick={() => void findEmails()}
              >
                Find emails for entire batch
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Email discovery checks publicly indexed contact details on each listed website. Found
            addresses include evidence and remain unverified until reviewed.
          </p>
          {busy === "emails" && (
            <div className="space-y-3">
              <GlassLoading
                label={`Finding emails · ${progress.done} of ${progress.total} · ${progress.found} found`}
                progress={progress}
              />
              <button className={button} onClick={() => emailController.current?.abort()}>
                Stop email search
              </button>
            </div>
          )}
          {detailError && (
            <p role="alert" className="text-sm text-destructive">
              {detailError}{" "}
              <button className="underline" onClick={() => setRefresh((value) => value + 1)}>
                Retry details
              </button>
            </p>
          )}
          {detailLoading ? (
            <GlassLoading label="Loading batch leads…" variant="table" rows={6} />
          ) : detailError ? null : !visible.length ? (
            <p className="rounded-xl bg-secondary/40 p-6 text-sm">
              {leads.length
                ? "No leads match this filter."
                : "This search returned no results. Try another niche or location."}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((lead) => (
                <article
                  key={lead.id}
                  className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{lead.name}</h3>
                    <button
                      className={button}
                      disabled={Boolean(busy) || lead.shortlisted}
                      onClick={() => void act(lead, "shortlist")}
                    >
                      {lead.shortlisted ? "Shortlisted" : "Shortlist"}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lead.source === "maps" ? "Google Maps" : "Web search"}
                    {lead.category ? ` · ${lead.category}` : ""}
                  </p>
                  {lead.description && (
                    <p className="text-sm text-muted-foreground">{lead.description}</p>
                  )}
                  {lead.address && <p className="text-sm">{lead.address}</p>}
                  {lead.phone && <p className="text-sm">Phone: {lead.phone}</p>}
                  {lead.source === "maps" && (
                    <p className="text-sm text-muted-foreground">
                      {lead.rating === null ? "Rating unavailable" : `${lead.rating}/5`}
                      {lead.review_count === null
                        ? " · Review count unavailable"
                        : ` · ${lead.review_count} reviews`}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4">
                    <Link url={lead.source_url}>Source listing</Link>
                    <Link url={lead.website_url}>Website</Link>
                  </div>
                  {lead.contact_email && (
                    <div className="space-y-2 text-sm">
                      <p className="break-all">
                        {lead.contact_email} · {lead.contact_status}
                      </p>
                      <Link url={lead.contact_source_url}>Email evidence</Link>
                      {lead.contact_status !== "verified" && (
                        <button
                          disabled={Boolean(busy)}
                          className={button}
                          onClick={() => void act(lead, "verify-email")}
                        >
                          I’ve checked this — verify email
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    disabled={Boolean(busy) || Boolean(lead.contact_email)}
                    className={button}
                    onClick={() => void act(lead, "find-email")}
                  >
                    {busy === lead.id
                      ? "Working…"
                      : lead.contact_email
                        ? "Email saved"
                        : "Find email"}
                  </button>
                  {messages[lead.id] && (
                    <p role="status" className="text-xs text-muted-foreground">
                      {messages[lead.id]}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
