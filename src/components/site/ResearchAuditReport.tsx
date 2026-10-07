import type { WorkflowSnapshot } from "@/lib/author-audit/workflow.server";
import { label } from "@/lib/author-audit/workflow";
import { reportBrand, sectionNarrative } from "@/lib/author-audit/report-presentation";
import { Logo } from "@/components/Logo";

type Report = WorkflowSnapshot;
type Finding = Report["findings"][number];

const ORANGE = "#ff5a00";
const PRIORITY: Record<string, { text: string; className: string }> = {
  immediate: { text: "Do first", className: "bg-[#ff5a00] text-black" },
  high_impact: { text: "High impact", className: "border border-[#ff5a00]/60 text-[#ff8a3d]" },
  medium_priority: { text: "Worth doing", className: "border border-amber-300/40 text-amber-200" },
  long_term: { text: "Long term", className: "border border-white/15 text-slate-300" },
  optional: { text: "Optional", className: "border border-white/15 text-slate-400" },
};
const CLASSIFICATION: Record<string, string> = {
  verified_fact: "Verified fact",
  direct_observation: "What we observed",
  supported_inference: "Our interpretation",
  possible_opportunity: "Opportunity",
};
const HORIZONS = [
  ["do_first", "Do first"],
  ["next_30_days", "Next 30 days"],
  ["next_90_days", "Next 90 days"],
  ["long_term", "Long term"],
] as const;
const METRICS: [keyof Report["metrics"], string][] = [
  ["platforms", "Platforms checked"],
  ["sources", "Sources reviewed"],
  ["findings", "Findings"],
  ["screenshots", "Screenshots"],
  ["actions", "Priority actions"],
];

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

export function ResearchAuditReport({
  report: r,
  imageBase = "/api/private-audit?asset=",
}: {
  report: Report;
  imageBase?: string;
}) {
  const sections = r.sections.map((s) => ({
    ...s,
    title: reportBrand(s.title),
    ...sectionNarrative(s.content),
  }));
  const summary = sections.find((s) => s.key === "executive_summary")?.text;
  const bodySections = sections.filter(
    (s) =>
      s.key !== "executive_summary" && (s.text || r.findings.some((f) => f.category === s.key)),
  );
  const looseEvidence = r.assets.filter((a) => !a.finding_id && !a.listopia_id);
  const metrics = METRICS.filter(([k]) => Number(r.metrics[k]) > 0);
  const services = r.actions.filter((a) => a.service);
  const contents = [
    ...(summary ? [["summary", "Summary"]] : []),
    ...bodySections.map((s) => [s.key, s.title]),
    ...(r.listopia.length ? [["listopia", "Goodreads Listopia"]] : []),
    ...(r.actions.length ? [["plan", "Action plan"]] : []),
    ...(services.length ? [["recommendations", "Recommendations"]] : []),
    ...(looseEvidence.length ? [["evidence", "Evidence"]] : []),
    ["method", "How we did this"],
  ] as [string, string][];

  const figures = (items: Report["assets"]) =>
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

  return (
    <article className="min-h-screen bg-[#0a0a0b] text-[#f5f2ed] antialiased">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[720px] rounded-full opacity-60 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${ORANGE}55, transparent)` }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pt-8 pb-14 sm:px-10 sm:pt-10 sm:pb-20">
          <div className="flex items-center justify-between gap-4">
            <Logo variant="mono" size={36} />
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">
              Private report
            </span>
          </div>
          <div className="mt-16 sm:mt-24">
            <Eyebrow>HQ360 Book Visibility Audit</Eyebrow>
            <h1 className="mt-5 max-w-4xl font-display text-[2.6rem] leading-[1.02] tracking-tight sm:text-7xl">
              {r.book.title}
            </h1>
            <p className="mt-5 text-xl text-slate-300 sm:text-2xl">
              Prepared for <span className="text-white">{r.author.name}</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-white/[.06] px-3 py-1.5">
                Research reviewed {r.preparedDate}
              </span>
              <span className="rounded-full bg-white/[.06] px-3 py-1.5">Prepared by HQ360</span>
            </div>
          </div>
          {summary && (
            <div
              id="summary"
              className="mt-12 max-w-3xl scroll-mt-24 rounded-3xl border border-[#ff5a00]/30 bg-[#ff5a00]/[.07] p-6 sm:p-8"
            >
              <Eyebrow>Executive summary</Eyebrow>
              <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-slate-100">
                {summary}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Contents */}
      <nav
        aria-label="Report contents"
        className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0a0b]/85 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 py-3 sm:px-10">
          {contents.map(([id, title]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:border-[#ff5a00]/60 hover:text-white"
            >
              {title}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 sm:px-10">
        {/* Findings by section */}
        {bodySections.map((s, i) => (
          <section key={s.key} id={s.key} className="scroll-mt-20 border-t border-white/10 py-14">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-sm text-[#ff8a3d]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-display text-3xl tracking-tight sm:text-4xl">{s.title}</h2>
            </div>
            {s.text && (
              <p className="mt-5 max-w-3xl leading-relaxed whitespace-pre-line text-slate-300">
                {s.text}
              </p>
            )}
            {s.sources.filter(
              (url) => !r.findings.some((f) => f.category === s.key && f.source_urls.includes(url)),
            ).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {s.sources
                  .filter(
                    (url) =>
                      !r.findings.some((f) => f.category === s.key && f.source_urls.includes(url)),
                  )
                  .map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:text-white"
                    >
                      {host(url)} ↗
                    </a>
                  ))}
              </div>
            )}
            <div className="mt-8 space-y-6">
              {r.findings
                .filter((f) => f.category === s.key)
                .sort((a, b) => Number(b.featured) - Number(a.featured))
                .map((f) => (
                  <FindingCard
                    key={f.id}
                    f={f}
                    evidence={figures(r.assets.filter((a) => a.finding_id === f.id))}
                  />
                ))}
            </div>
          </section>
        ))}

        {/* Listopia */}
        {r.listopia.length > 0 && (
          <section id="listopia" className="scroll-mt-20 space-y-6 border-t border-white/10 py-14">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">Goodreads Listopia</h2>
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
                    ["Current position", l.position == null ? null : `#${l.position}`, true],
                    ["Page", l.page, false],
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
                    <h3 className="text-sm font-semibold text-white">
                      How to improve · next action
                    </h3>
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

        {/* Action plan */}
        {r.actions.length > 0 && (
          <section id="plan" className="scroll-mt-20 border-t border-white/10 py-14">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Priority action plan
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {HORIZONS.filter(([h]) => r.actions.some((a) => a.horizon === h)).map(
                ([h, title], col) => (
                  <div
                    key={h}
                    className={`rounded-3xl border p-6 ${col === 0 ? "border-[#ff5a00]/40 bg-[#ff5a00]/[.07]" : "border-white/10 bg-white/[.025]"}`}
                  >
                    <Eyebrow>{title}</Eyebrow>
                    <ol className="mt-5 space-y-5">
                      {r.actions
                        .filter((a) => a.horizon === h)
                        .map((a, i) => (
                          <li key={a.id} className="flex gap-3">
                            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs text-white">
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
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {/* HQ360 recommendations */}
        {services.length > 0 && (
          <section id="recommendations" className="scroll-mt-20 border-t border-white/10 py-14">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">How HQ360 can help</h2>
            <p className="mt-3 max-w-2xl text-slate-400">
              Only where this audit found a specific reason to — not every service, just the ones
              your findings point to.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {services.map((a) => (
                <div key={a.id} className="rounded-3xl border border-white/10 bg-white/[.025] p-6">
                  <h3 className="text-lg font-semibold text-white">{a.service}</h3>
                  {a.description && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      <span className="text-slate-300">Recommended because: </span>
                      {a.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {r.ctaEnabled && (
              <a
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ff5a00] px-6 py-3 font-semibold text-black hover:bg-[#ff7a2e]"
                href="/contact"
              >
                Discuss your action plan ↗
              </a>
            )}
          </section>
        )}

        {/* Evidence library */}
        {looseEvidence.length > 0 && (
          <section id="evidence" className="scroll-mt-20 space-y-6 border-t border-white/10 py-14">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">Evidence library</h2>
            {figures(looseEvidence)}
          </section>
        )}

        {/* Methodology */}
        <section id="method" className="scroll-mt-20 border-t border-white/10 py-14">
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-10">
            <Eyebrow>Methodology</Eyebrow>
            <h2 className="mt-3 font-display text-2xl text-white sm:text-3xl">
              How HQ360 conducted this audit
            </h2>
            <div className="mt-5 max-w-3xl space-y-4 leading-relaxed text-slate-400">
              <p>
                HQ360 reviewed public book, author, retailer and reader-discovery sources, using
                AI-assisted research where helpful. Findings distinguish verified observations from
                interpretations and reflect the sources available on the research date.
              </p>
            </div>
            {metrics.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {metrics.map(([key, title]) => (
                  <span
                    key={key}
                    className="rounded-full bg-white/[.06] px-3 py-1.5 text-xs text-slate-300"
                  >
                    {r.metrics[key]} {title.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-slate-500 sm:px-10">
          <Logo variant="mono" size={24} />
          <span>Prepared by HQ360 · Private and confidential · {r.preparedDate}</span>
        </div>
      </footer>
    </article>
  );
}

function FindingCard({ f, evidence }: { f: Finding; evidence: React.ReactNode }) {
  const priority = PRIORITY[f.priority] ?? PRIORITY.medium_priority!;
  const kind = CLASSIFICATION[f.classification];
  return (
    <div
      className={`space-y-6 rounded-3xl border bg-white/[.025] p-6 sm:p-8 ${f.featured ? "border-[#ff5a00]/40" : "border-white/10"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-semibold ${priority.className}`}>
          {priority.text}
        </span>
        {kind && <span className="text-slate-400">{kind}</span>}
      </div>
      <h3 className="font-display text-2xl leading-snug tracking-tight text-white">{f.title}</h3>
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
        <div className="grid gap-6 text-sm sm:grid-cols-2">
          {f.evidence && (
            <div>
              <h4 className="text-[11px] font-semibold tracking-[.2em] text-slate-500 uppercase">
                Evidence
              </h4>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-400">
                {f.evidence}
              </p>
            </div>
          )}
        </div>
      )}
      {evidence}
      {f.source_urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.source_urls.map((url) => (
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
      )}
    </div>
  );
}
