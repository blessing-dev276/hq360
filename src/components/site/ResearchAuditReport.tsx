import type { WorkflowSnapshot } from "@/lib/author-audit/workflow.server";
import { label } from "@/lib/author-audit/workflow";
import { Logo } from "@/components/Logo";
export function ResearchAuditReport({
  report: r,
  imageBase = "/api/private-audit?asset=",
}: {
  report: WorkflowSnapshot;
  imageBase?: string;
}) {
  const evidence = (findingId?: string, listopiaId?: string) =>
    r.assets
      .filter((a) =>
        findingId
          ? a.finding_id === findingId
          : listopiaId
            ? a.listopia_id === listopiaId
            : !a.finding_id && !a.listopia_id,
      )
      .map((a) => (
        <figure
          key={a.id}
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
        >
          <img
            loading="lazy"
            className="max-h-[600px] w-full object-contain"
            src={`${imageBase}${a.id}`}
            alt={a.caption || a.proves || "Audit evidence"}
          />
          <figcaption className="space-y-1 p-4 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-widest text-emerald-300">
              {a.display_kind}
            </span>
            <p>{a.caption}</p>
            <p>{a.proves}</p>
            {a.source && (
              <a href={a.source} target="_blank" rel="noreferrer" className="underline">
                Source ↗
              </a>
            )}
            {a.asset_date && <p>Captured {a.asset_date}</p>}
          </figcaption>
        </figure>
      ));
  return (
    <article className="min-h-screen bg-[#0a1014] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-10 sm:py-16">
        <header className="border-b border-white/10 pb-12">
          <Logo size={44} />
          <p className="mt-12 text-xs font-semibold uppercase tracking-[.25em] text-emerald-300">
            HQ360 Book Visibility Audit
          </p>
          <h1 className="mt-5 max-w-4xl font-display text-4xl leading-tight sm:text-6xl">
            {r.book.title}
          </h1>
          <p className="mt-5 text-xl text-slate-300">Prepared for {r.author.name}</p>
          <p className="mt-3 text-sm text-slate-400">
            Research reviewed {r.preparedDate} · Prepared by HQ360
          </p>
          {r.sections.find((s) => s.key === "executive_summary")?.content && (
            <p className="mt-8 max-w-3xl whitespace-pre-line text-lg leading-relaxed text-slate-300">
              {r.sections.find((s) => s.key === "executive_summary")?.content}
            </p>
          )}
        </header>
        <section className="py-10">
          <p className="text-xs uppercase tracking-widest text-emerald-300">Audit snapshot</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(r.metrics).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <strong className="text-3xl">{value}</strong>
                <p className="mt-2 text-xs uppercase tracking-wider text-slate-400">{label(key)}</p>
              </div>
            ))}
          </div>
        </section>
        {r.sections
          .filter(
            (s) =>
              s.key !== "executive_summary" &&
              (s.content || r.findings.some((f) => f.category === s.key)),
          )
          .map((s) => (
            <section key={s.key} className="border-t border-white/10 py-10" id={s.key}>
              <h2 className="font-display text-3xl">{s.title}</h2>
              {s.content && (
                <p className="mt-5 whitespace-pre-line leading-relaxed text-slate-300">
                  {s.content}
                </p>
              )}
              <div className="mt-6 space-y-6">
                {r.findings
                  .filter((f) => f.category === s.key)
                  .sort((a, b) => Number(b.featured) - Number(a.featured))
                  .map((f) => (
                    <div
                      key={f.id}
                      className="space-y-5 rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-8"
                    >
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">
                          {label(f.priority)}
                        </span>
                        <span className="py-1 text-slate-400">{label(f.classification)}</span>
                      </div>
                      <h3 className="text-2xl font-semibold">{f.title}</h3>
                      <div className="grid gap-6 sm:grid-cols-2">
                        {[
                          ["What we checked", f.what_we_checked],
                          ["What we found", f.what_we_found],
                          ["Why it matters", f.why_it_matters],
                          ["What we recommend", f.recommendation],
                          ["Evidence", f.evidence],
                          ["Interpretation", f.interpretation],
                        ]
                          .filter(([, v]) => v)
                          .map(([title, value]) => (
                            <div key={title}>
                              <h4 className="text-xs uppercase tracking-widest text-emerald-300">
                                {title}
                              </h4>
                              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-300">
                                {value}
                              </p>
                            </div>
                          ))}
                      </div>
                      {f.implementation_steps.length > 0 && (
                        <div>
                          <h4 className="text-xs uppercase tracking-widest text-emerald-300">
                            How to fix it
                          </h4>
                          <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-300">
                            {f.implementation_steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {evidence(f.id)}
                      <div className="flex flex-wrap gap-3 text-sm">
                        {f.source_urls.map((url, i) => (
                          <a
                            className="text-emerald-300 underline"
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source {i + 1} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        {r.listopia.length > 0 && (
          <section className="space-y-6 border-t border-white/10 py-10">
            <h2 className="font-display text-3xl">Goodreads Listopia</h2>
            {r.listopia.map((l) => (
              <div key={l.id} className="rounded-3xl border border-white/10 p-6">
                <a
                  className="text-xl text-emerald-300"
                  href={l.list_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {l.list_name} ↗
                </a>
                <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ["Current position", l.position === null ? "Unknown" : `#${l.position}`],
                    ["Page", l.page ?? "Unknown"],
                    ["Votes", l.votes ?? "Unknown"],
                    ["Competition", label(l.competition)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-slate-400">{k}</p>
                      <strong className="text-3xl">{v}</strong>
                    </div>
                  ))}
                </div>
                {l.books_above.length > 0 && (
                  <p className="text-sm text-slate-400">Above: {l.books_above.join(" · ")}</p>
                )}
                {l.books_below.length > 0 && (
                  <p className="text-sm text-slate-400">Below: {l.books_below.join(" · ")}</p>
                )}
                <div className="my-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">Why you are here</h3>
                    <p className="mt-2 whitespace-pre-line text-slate-300">
                      {l.why_position || "The cause of this position has not been established."}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      This interpretation does not establish how Goodreads ranks lists.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">How to improve · next action</h3>
                    <p className="mt-2 whitespace-pre-line text-slate-300">{l.how_to_improve}</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-slate-400">{l.evidence}</p>
                {evidence(undefined, l.id)}
              </div>
            ))}
          </section>
        )}
        {r.actions.length > 0 && (
          <section className="border-t border-white/10 py-10">
            <h2 className="font-display text-3xl">Priority action plan</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {["do_first", "next_30_days", "next_90_days", "long_term"].map(
                (h) =>
                  r.actions.some((a) => a.horizon === h) && (
                    <div key={h} className="rounded-2xl border border-white/10 p-6">
                      <h3 className="text-xs uppercase tracking-widest text-emerald-300">
                        {label(h)}
                      </h3>
                      {r.actions
                        .filter((a) => a.horizon === h)
                        .map((a) => (
                          <div className="mt-5" key={a.id}>
                            <h4 className="font-semibold">{a.title}</h4>
                            <p className="mt-2 whitespace-pre-line text-slate-300">
                              {a.description}
                            </p>
                          </div>
                        ))}
                    </div>
                  ),
              )}
            </div>
          </section>
        )}
        {r.actions.some((a) => a.service) && (
          <section className="border-t border-white/10 py-10">
            <h2 className="font-display text-3xl">HQ360 recommendations</h2>
            {r.actions
              .filter((a) => a.service)
              .map((a) => (
                <div key={a.id} className="mt-6 rounded-2xl border border-white/10 p-6">
                  <h3 className="text-xl">{a.service}</h3>
                  <p className="mt-2 text-slate-300">{a.description}</p>
                </div>
              ))}
            {r.ctaEnabled && (
              <a
                className="mt-6 inline-block rounded-full bg-emerald-300 px-6 py-3 font-semibold text-slate-950"
                href="/contact"
              >
                Discuss your action plan ↗
              </a>
            )}
          </section>
        )}
        {evidence().length > 0 && (
          <section className="space-y-5 border-t border-white/10 py-10">
            <h2 className="font-display text-3xl">Evidence library</h2>
            {evidence()}
          </section>
        )}
        <section className="space-y-5 border-t border-white/10 py-10 text-slate-400">
          <h2 className="font-display text-2xl text-white">How HQ360 conducted this audit</h2>
          <p>
            This audit was researched and reviewed by HQ360 using publicly available information
            across the author’s publishing ecosystem. Our process combines platform inspection, book
            and author research, retailer analysis, reader-path analysis, competitive research, and
            manual verification.
          </p>
          <p>
            AI-assisted research tools may be used to accelerate information gathering and
            organization, but findings presented in this audit are reviewed by HQ360 before
            publication. We distinguish verified observations from strategic interpretations and do
            not present unverified assumptions as facts.
          </p>
          <p>
            {r.metrics.sources} sources reviewed · {r.metrics.platforms} platforms checked ·{" "}
            {r.metrics.screenshots} screenshots · {r.metrics.findings} findings ·{" "}
            {r.metrics.actions} approved actions
          </p>
        </section>
      </div>
    </article>
  );
}
