import { useEffect, useMemo, useState } from "react";
import type { WorkflowSnapshot } from "@/lib/author-audit/workflow.server";
import { label } from "@/lib/author-audit/workflow";
import { reportBrand, sectionNarrative } from "@/lib/author-audit/report-presentation";
import { Logo } from "@/components/Logo";

type Report = WorkflowSnapshot;
type Finding = Report["findings"][number];
type Asset = Report["assets"][number];

const PRIORITY: Record<string, { text: string; rank: number; className: string }> = {
  immediate: { text: "Do first", rank: 0, className: "bg-[#ff5a00] text-black" },
  high_impact: {
    text: "High impact",
    rank: 1,
    className: "border border-[#ff5a00]/60 text-[#ff8a3d]",
  },
  medium_priority: {
    text: "Worth doing",
    rank: 2,
    className: "border border-amber-300/40 text-amber-200",
  },
  long_term: { text: "Long term", rank: 3, className: "border border-white/15 text-slate-300" },
  optional: { text: "Optional", rank: 4, className: "border border-white/15 text-slate-400" },
};
const priorityOf = (f: Finding) => PRIORITY[f.priority] ?? PRIORITY.medium_priority!;
const byPriority = (a: Finding, b: Finding) =>
  Number(b.featured) - Number(a.featured) || priorityOf(a).rank - priorityOf(b).rank;
const HORIZONS = [
  ["do_first", "Do first", "This week"],
  ["next_30_days", "Next 30 days", "This month"],
  ["next_90_days", "Next 90 days", "This quarter"],
  ["long_term", "Long term", "Ongoing"],
] as const;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
};
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold tracking-[.28em] text-[#ff8a3d] uppercase">{children}</p>
);
const firstSentence = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^.{20,220}?[.!?](\s|$)/);
  return m ? m[0].trim() : t.length > 220 ? `${t.slice(0, 217)}…` : t;
};

type Page = { id: string; title: string; group: "start" | "areas" | "next" };

/** The client-facing audit: a small multi-page site (Overview, one page per
 *  audit area, action plan, lists, help, evidence). Pages are kept in the
 *  ?page= query so Back and shared links work. */
export function ResearchAuditReport({
  report: r,
  imageBase = "/api/private-audit?asset=",
  initialPage = "overview",
  syncUrl = true,
}: {
  report: Report;
  imageBase?: string;
  initialPage?: string;
  /** false inside the staff preview, so the admin page URL isn't touched. */
  syncUrl?: boolean;
}) {
  const sections = useMemo(
    () =>
      r.sections.map((s) => ({
        ...s,
        title: reportBrand(s.title),
        ...sectionNarrative(s.content),
      })),
    [r.sections],
  );
  const summary = sections.find((s) => s.key === "executive_summary")?.text;
  const areas = sections.filter(
    (s) =>
      s.key !== "executive_summary" && (s.text || r.findings.some((f) => f.category === s.key)),
  );
  const looseEvidence = r.assets.filter((a) => !a.finding_id && !a.listopia_id);
  const services = r.actions.filter((a) => a.service);
  const pages: Page[] = [
    { id: "overview", title: "Overview", group: "start" },
    ...areas.map((s) => ({ id: s.key, title: s.title, group: "areas" as const })),
    ...(r.listopia.length
      ? [{ id: "listopia", title: "Goodreads lists", group: "areas" as const }]
      : []),
    ...(r.actions.length ? [{ id: "plan", title: "Action plan", group: "next" as const }] : []),
    ...(services.length
      ? [{ id: "help", title: "How HQ360 can help", group: "next" as const }]
      : []),
    ...(looseEvidence.length
      ? [{ id: "evidence", title: "Evidence", group: "next" as const }]
      : []),
  ];

  const [page, setPage] = useState(() =>
    pages.some((p) => p.id === initialPage) ? initialPage : "overview",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!syncUrl) return;
    const read = () => {
      const want = new URL(window.location.href).searchParams.get("page") ?? "overview";
      setPage(pages.some((p) => p.id === want) ? want : "overview");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUrl]);
  function go(id: string) {
    setPage(id);
    setMenuOpen(false);
    if (syncUrl) {
      const url = new URL(window.location.href);
      if (id === "overview") url.searchParams.delete("page");
      else url.searchParams.set("page", id);
      window.history.pushState(null, "", url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  const current = pages.find((p) => p.id === page) ?? pages[0]!;
  const areaIndex = areas.findIndex((s) => s.key === page);

  const figures = (items: Asset[]) =>
    items.length > 0 && (
      <div className={`grid gap-4 ${items.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {items.map((a) => (
          <figure
            key={a.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/40"
          >
            <img
              loading="lazy"
              className="max-h-[560px] w-full bg-white/[.02] object-contain"
              src={`${imageBase}${a.id}`}
              alt={a.caption || a.proves || "Audit evidence"}
            />
            {(a.caption || a.proves || a.source) && (
              <figcaption className="space-y-1.5 border-t border-white/10 p-4 text-sm text-slate-300">
                {a.display_kind && (
                  <span className="text-[10px] font-semibold tracking-[.2em] text-[#ff8a3d] uppercase">
                    {label(a.display_kind)}
                  </span>
                )}
                {a.caption && <p className="text-slate-200">{a.caption}</p>}
                {a.proves && <p className="text-slate-400">{a.proves}</p>}
                <p className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {a.asset_date && <span>Captured {a.asset_date}</span>}
                  {a.source && (
                    <a
                      href={a.source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ff8a3d] hover:underline"
                    >
                      {host(a.source)} ↗
                    </a>
                  )}
                </p>
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );

  const navGroups: [Page["group"], string][] = [
    ["start", ""],
    ["areas", "Audit areas"],
    ["next", "Next steps"],
  ];
  const nav = (
    <nav aria-label="Audit pages" className="space-y-6">
      {navGroups.map(([group, heading]) => {
        const items = pages.filter((p) => p.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            {heading && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[.24em] text-slate-500 uppercase">
                {heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((p) => {
                const count = r.findings.filter((f) => f.category === p.id).length;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => go(p.id)}
                      aria-current={p.id === page ? "page" : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        p.id === page
                          ? "bg-[#ff5a00]/15 font-medium text-white"
                          : "text-slate-400 hover:bg-white/[.04] hover:text-white"
                      }`}
                    >
                      <span>{p.title}</span>
                      {count > 0 && (
                        <span
                          className={`text-[11px] ${p.id === page ? "text-[#ff8a3d]" : "text-slate-600"}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <article className="min-h-screen bg-[#0a0a0b] text-[#f5f2ed] antialiased">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0b]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <button type="button" onClick={() => go("overview")} aria-label="Audit overview">
            <Logo variant="mono" size={30} />
          </button>
          <p className="hidden min-w-0 truncate text-sm text-slate-400 md:block">
            <span className="text-slate-200">{r.book.title}</span> · {r.author.name}
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 sm:inline">
              Private audit
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white lg:hidden"
            >
              {menuOpen ? "Close" : "Pages"}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="max-h-[70vh] overflow-y-auto border-t border-white/10 px-5 py-5 lg:hidden">
            {nav}
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-5 sm:px-8">
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-60 shrink-0 overflow-y-auto py-10 lg:block">
          {nav}
        </aside>

        <main className="min-w-0 flex-1 py-10 sm:py-14" key={page}>
          <div className="hq-fade-in">
            {page === "overview" && (
              <Overview r={r} summary={summary} areas={areas} pages={pages} go={go} />
            )}

            {areaIndex >= 0 &&
              (() => {
                const s = areas[areaIndex]!;
                const findings = r.findings.filter((f) => f.category === s.key).sort(byPriority);
                const extraSources = s.sources.filter(
                  (url) => !findings.some((f) => f.source_urls.includes(url)),
                );
                const prev = areas[areaIndex - 1];
                const next = areas[areaIndex + 1];
                return (
                  <section id={s.key} aria-labelledby={`${s.key}-title`}>
                    <Eyebrow>
                      Audit area {String(areaIndex + 1).padStart(2, "0")} of{" "}
                      {String(areas.length).padStart(2, "0")}
                    </Eyebrow>
                    <h1
                      id={`${s.key}-title`}
                      className="mt-4 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl"
                    >
                      {s.title}
                    </h1>
                    {s.text && (
                      <p className="mt-6 max-w-3xl text-lg leading-relaxed whitespace-pre-line text-slate-300">
                        {s.text}
                      </p>
                    )}
                    {extraSources.length > 0 && <SourceChips urls={extraSources} />}
                    {findings.length > 0 && (
                      <div className="mt-10 space-y-4">
                        <p className="text-sm text-slate-500">
                          {findings.length} finding{findings.length === 1 ? "" : "s"} · open one for
                          the details and the fix
                        </p>
                        {findings.map((f, i) => (
                          <FindingCard
                            key={f.id}
                            f={f}
                            open={i === 0}
                            evidence={figures(r.assets.filter((a) => a.finding_id === f.id))}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-14 grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-2">
                      {prev ? (
                        <PagerButton
                          dir="Previous"
                          title={prev.title}
                          onClick={() => go(prev.key)}
                        />
                      ) : (
                        <PagerButton
                          dir="Back to"
                          title="Overview"
                          onClick={() => go("overview")}
                        />
                      )}
                      {next ? (
                        <PagerButton
                          dir="Next"
                          title={next.title}
                          onClick={() => go(next.key)}
                          align="end"
                        />
                      ) : (
                        pages.find((p) => p.group === "next") && (
                          <PagerButton
                            dir="Next"
                            title={pages.find((p) => p.group === "next")!.title}
                            onClick={() => go(pages.find((p) => p.group === "next")!.id)}
                            align="end"
                          />
                        )
                      )}
                    </div>
                  </section>
                );
              })()}

            {page === "listopia" && (
              <section id="listopia" className="space-y-6">
                <Eyebrow>Goodreads</Eyebrow>
                <h1 className="font-display text-4xl tracking-tight sm:text-6xl">
                  Goodreads lists
                </h1>
                <p className="max-w-2xl text-lg text-slate-400">
                  The reader-voted Listopia lists where your book appears or belongs, and how to
                  move up.
                </p>
                {r.listopia.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8"
                  >
                    {l.list_url ? (
                      <a
                        className="text-xl text-white hover:text-[#ff8a3d]"
                        href={l.list_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {l.list_name} <span className="text-[#ff8a3d]">↗</span>
                      </a>
                    ) : (
                      <p className="text-xl text-white">{l.list_name}</p>
                    )}
                    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ["Your position", l.position == null ? null : `#${l.position}`, true],
                        ["On page", l.page, false],
                        ["Votes", l.votes, false],
                        [
                          "Competition",
                          l.competition === "unknown" ? null : label(l.competition),
                          false,
                        ],
                      ]
                        .filter(([, v]) => v != null)
                        .map(([k, v, hero]) => (
                          <div
                            key={String(k)}
                            className={`rounded-2xl p-4 ${hero ? "bg-[#ff5a00]/[.12]" : "bg-white/[.04]"}`}
                          >
                            <p className="text-xs text-slate-400">{k}</p>
                            <strong
                              className={`mt-1 block font-display text-3xl ${hero ? "text-[#ff8a3d]" : "text-white"}`}
                            >
                              {v}
                            </strong>
                          </div>
                        ))}
                    </div>
                    {(l.books_above.length > 0 || l.books_below.length > 0) && (
                      <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
                        {l.books_above.length > 0 && (
                          <p className="text-slate-400">
                            <span className="text-slate-500">Just above you:</span>{" "}
                            {l.books_above.join(" · ")}
                          </p>
                        )}
                        {l.books_below.length > 0 && (
                          <p className="text-slate-400">
                            <span className="text-slate-500">Just below you:</span>{" "}
                            {l.books_below.join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {l.position == null ? "List relevance" : "Why you are here"}
                        </h3>
                        <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-300">
                          {l.why_position || "The cause of this position has not been established."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#ff5a00]/30 bg-[#ff5a00]/[.06] p-5">
                        <h3 className="text-sm font-semibold text-white">How to move up</h3>
                        <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-200">
                          {l.how_to_improve}
                        </p>
                      </div>
                    </div>
                    {l.evidence && <p className="mt-5 text-sm text-slate-400">{l.evidence}</p>}
                    <div className="mt-5">
                      {figures(r.assets.filter((a) => a.listopia_id === l.id))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {page === "plan" && (
              <section id="plan">
                <Eyebrow>Your roadmap</Eyebrow>
                <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-6xl">
                  Action plan
                </h1>
                <p className="mt-5 max-w-2xl text-lg text-slate-400">
                  Everything this audit recommends, in the order to do it.
                </p>
                <ol className="mt-10 space-y-10">
                  {HORIZONS.filter(([h]) => r.actions.some((a) => a.horizon === h)).map(
                    ([h, title, when], col) => (
                      <li key={h} className="relative grid gap-5 sm:grid-cols-[180px_1fr]">
                        <div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${col === 0 ? "bg-[#ff5a00] text-black" : "bg-white/[.07] text-slate-200"}`}
                          >
                            {title}
                          </span>
                          <p className="mt-2 text-sm text-slate-500">{when}</p>
                        </div>
                        <ol className="space-y-3">
                          {r.actions
                            .filter((a) => a.horizon === h)
                            .map((a, i) => (
                              <li
                                key={a.id}
                                className={`flex gap-4 rounded-2xl border p-5 ${col === 0 ? "border-[#ff5a00]/35 bg-[#ff5a00]/[.06]" : "border-white/10 bg-white/[.025]"}`}
                              >
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-white">
                                  {i + 1}
                                </span>
                                <div>
                                  <h3 className="font-semibold text-white">{a.title}</h3>
                                  {a.description && (
                                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-slate-400">
                                      {a.description}
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                        </ol>
                      </li>
                    ),
                  )}
                </ol>
              </section>
            )}

            {page === "help" && (
              <section id="recommendations">
                <Eyebrow>Working together</Eyebrow>
                <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-6xl">
                  How HQ360 can help
                </h1>
                <p className="mt-5 max-w-2xl text-lg text-slate-400">
                  Only where this audit found a specific reason to — not every service, just the
                  ones your findings point to.
                </p>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  {services.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-6"
                    >
                      <h3 className="font-display text-xl text-white">{a.service}</h3>
                      {a.description && (
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          <span className="text-slate-300">Recommended because: </span>
                          {a.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {r.ctaEnabled && (
                  <a
                    className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#ff5a00] px-7 py-3.5 font-semibold text-black hover:bg-[#ff7a2e]"
                    href="/contact"
                  >
                    Discuss your action plan ↗
                  </a>
                )}
              </section>
            )}

            {page === "evidence" && (
              <section id="evidence" className="space-y-6">
                <Eyebrow>Proof</Eyebrow>
                <h1 className="font-display text-4xl tracking-tight sm:text-6xl">Evidence</h1>
                {figures(looseEvidence)}
              </section>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-slate-500 sm:px-8">
          <Logo variant="mono" size={22} />
          <span>
            {current.title} · Prepared by HQ360 · Private and confidential · {r.preparedDate}
          </span>
        </div>
      </footer>
    </article>
  );
}

function Overview({
  r,
  summary,
  areas,
  pages,
  go,
}: {
  r: Report;
  summary: string | undefined;
  areas: { key: string; title: string; text: string }[];
  pages: Page[];
  go: (id: string) => void;
}) {
  const doFirst = r.findings.filter((f) => f.priority === "immediate").length;
  const top = [...r.findings].sort(byPriority).slice(0, 3);
  const stats = [
    [r.findings.length, "Findings"],
    [doFirst, "To do first"],
    [areas.length, "Areas reviewed"],
    [r.metrics.sources, "Sources checked"],
  ].filter(([n]) => Number(n) > 0) as [number, string][];
  return (
    <div>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#1a0d05] via-[#0f0b09] to-[#0a0a0b] px-6 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[520px] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #ff5a0066, transparent)" }}
        />
        <div className="relative">
          <Eyebrow>Book visibility audit</Eyebrow>
          <h1 className="mt-5 max-w-4xl font-display text-[2.7rem] leading-[1] tracking-tight sm:text-7xl">
            {r.book.title}
          </h1>
          <p className="mt-5 text-xl text-slate-300">
            Prepared for <span className="text-white">{r.author.name}</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">Research reviewed {r.preparedDate}</p>
          {stats.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(([n, t], i) => (
                <div
                  key={t}
                  className={`rounded-2xl border p-4 ${i === 1 ? "border-[#ff5a00]/40 bg-[#ff5a00]/10" : "border-white/10 bg-white/[.03]"}`}
                >
                  <dt className="text-xs text-slate-400">{t}</dt>
                  <dd
                    className={`mt-1 font-display text-4xl ${i === 1 ? "text-[#ff8a3d]" : "text-white"}`}
                  >
                    {n}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {summary && (
        <section id="summary" className="mt-12 grid gap-6 lg:grid-cols-[220px_1fr]">
          <Eyebrow>The short version</Eyebrow>
          <p className="max-w-3xl text-xl leading-relaxed whitespace-pre-line text-slate-100">
            {summary}
          </p>
        </section>
      )}

      {top.length > 0 && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Start here</Eyebrow>
              <h2 className="mt-3 font-display text-3xl tracking-tight">Your top priorities</h2>
            </div>
            {pages.some((p) => p.id === "plan") && (
              <button
                type="button"
                onClick={() => go("plan")}
                className="text-sm text-[#ff8a3d] hover:underline"
              >
                See the full action plan →
              </button>
            )}
          </div>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {top.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => go(f.category)}
                  className="group flex h-full w-full flex-col rounded-3xl border border-white/10 bg-white/[.025] p-6 text-left transition hover:-translate-y-0.5 hover:border-[#ff5a00]/50"
                >
                  <span className="font-display text-5xl text-[#ff5a00]/70">{i + 1}</span>
                  <span
                    className={`mt-4 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityOf(f).className}`}
                  >
                    {priorityOf(f).text}
                  </span>
                  <h3 className="mt-3 font-display text-lg leading-snug text-white">{f.title}</h3>
                  {f.recommendation && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {firstSentence(f.recommendation)}
                    </p>
                  )}
                  <span className="mt-auto pt-5 text-xs text-slate-500 group-hover:text-[#ff8a3d]">
                    Open details →
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {areas.length > 0 && (
        <section className="mt-14">
          <Eyebrow>Explore the audit</Eyebrow>
          <h2 className="mt-3 font-display text-3xl tracking-tight">What we reviewed</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {areas.map((s, i) => {
              const findings = r.findings.filter((f) => f.category === s.key);
              const urgent = findings.filter((f) => f.priority === "immediate").length;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(s.key)}
                  className="group rounded-2xl border border-white/10 bg-white/[.02] p-5 text-left transition hover:border-[#ff5a00]/50 hover:bg-white/[.04]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm text-slate-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-[#ff8a3d]">
                      →
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg text-white">{s.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {findings.length
                      ? `${findings.length} finding${findings.length === 1 ? "" : "s"}${urgent ? ` · ${urgent} to do first` : ""}`
                      : "Overview"}
                  </p>
                </button>
              );
            })}
            {pages
              .filter((p) => p.id === "listopia")
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => go(p.id)}
                  className="group rounded-2xl border border-white/10 bg-white/[.02] p-5 text-left transition hover:border-[#ff5a00]/50 hover:bg-white/[.04]"
                >
                  <span className="font-display text-sm text-slate-500">★</span>
                  <h3 className="mt-3 font-display text-lg text-white">{p.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {r.listopia.length} list{r.listopia.length === 1 ? "" : "s"}
                  </p>
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PagerButton({
  dir,
  title,
  onClick,
  align = "start",
}: {
  dir: string;
  title: string;
  onClick: () => void;
  align?: "start" | "end";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border border-white/10 p-5 transition hover:border-[#ff5a00]/50 ${align === "end" ? "text-right sm:col-start-2" : "text-left"}`}
    >
      <span className="text-xs text-slate-500">{align === "end" ? `${dir} →` : `← ${dir}`}</span>
      <span className="mt-1 block font-display text-lg text-white">{title}</span>
    </button>
  );
}

function SourceChips({ urls }: { urls: string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-[#ff5a00]/60 hover:text-white"
        >
          {host(url)} ↗
        </a>
      ))}
    </div>
  );
}

function FindingCard({
  f,
  open,
  evidence,
}: {
  f: Finding;
  open: boolean;
  evidence: React.ReactNode;
}) {
  const priority = priorityOf(f);
  return (
    <details
      open={open}
      className={`group rounded-3xl border bg-white/[.025] transition open:bg-white/[.035] ${f.featured || f.priority === "immediate" ? "border-[#ff5a00]/40" : "border-white/10"}`}
    >
      <summary className="flex cursor-pointer list-none items-start gap-4 p-6 sm:p-7 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priority.className}`}
          >
            {priority.text}
          </span>
          <h3 className="mt-3 font-display text-xl leading-snug tracking-tight text-white sm:text-2xl">
            {f.title}
          </h3>
          {f.what_we_found && (
            <p className="mt-2 text-sm leading-relaxed text-slate-400 group-open:hidden">
              {firstSentence(f.what_we_found)}
            </p>
          )}
        </div>
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-slate-300 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-6 px-6 pb-7 sm:px-7">
        {(f.what_we_checked || f.what_we_found) && (
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              ["What we checked", f.what_we_checked],
              ["What we found", f.what_we_found],
            ]
              .filter(([, v]) => v)
              .map(([title, value]) => (
                <div key={title}>
                  <h4 className="text-[11px] font-semibold tracking-[.2em] text-slate-500 uppercase">
                    {title}
                  </h4>
                  <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-300">{value}</p>
                </div>
              ))}
          </div>
        )}
        {(f.why_it_matters || f.recommendation) && (
          <div className="grid gap-5 rounded-2xl border border-[#ff5a00]/25 bg-[#ff5a00]/[.06] p-5 sm:grid-cols-2 sm:p-6">
            {f.why_it_matters && (
              <div>
                <h4 className="text-[11px] font-semibold tracking-[.2em] text-[#ff8a3d] uppercase">
                  Why it matters
                </h4>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-200">
                  {f.why_it_matters}
                </p>
              </div>
            )}
            {f.recommendation && (
              <div>
                <h4 className="text-[11px] font-semibold tracking-[.2em] text-[#ff8a3d] uppercase">
                  What we recommend
                </h4>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-200">
                  {f.recommendation}
                </p>
              </div>
            )}
          </div>
        )}
        {f.implementation_steps.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold tracking-[.2em] text-slate-500 uppercase">
              How to fix it
            </h4>
            <ol className="mt-3 space-y-2.5">
              {f.implementation_steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-slate-300">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-xs text-white">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {f.evidence && (
          <div className="text-sm">
            <h4 className="text-[11px] font-semibold tracking-[.2em] text-slate-500 uppercase">
              Evidence
            </h4>
            <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-400">{f.evidence}</p>
          </div>
        )}
        {evidence}
        {f.source_urls.length > 0 && <SourceChips urls={f.source_urls} />}
      </div>
    </details>
  );
}
