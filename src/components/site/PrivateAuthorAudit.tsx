import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import type { ReportData } from "@/lib/author-audit/report-data";
import {
  READER_JOURNEY_STAGE_LABEL,
  READER_JOURNEY_STAGE_ORDER,
} from "@/lib/author-audit/reader-journey-labels";
import "./private-author-audit.css";

async function auditRequest(body: unknown) {
  const res = await fetch("/api/private-audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Please try again.");
  return result;
}
export function PrivateAuditAccess() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await auditRequest({
        action: "login",
        code: String(new FormData(event.currentTarget).get("code") ?? ""),
      });
      window.location.assign(result.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="private-audit-access">
      <a href="/" aria-label="HQ360 home">
        <Logo size={48} />
      </a>
      <section>
        <p className="pa-eyebrow">Author visibility & growth audit</p>
        <h1>
          Your private
          <br />
          <em>HQ360 audit.</em>
        </h1>
        <p>A considered view of where you are today — and what deserves your attention next.</p>
        <form onSubmit={login}>
          <label>
            Access code
            <input
              name="code"
              required
              maxLength={80}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Enter the code from HQ360"
            />
          </label>
          <button disabled={busy}>{busy ? "Unlocking…" : "View my audit →"}</button>
          {error && <p role="alert">{error}</p>}
        </form>
        <small>This report is private and prepared specifically for the named author.</small>
        <a href="mailto:ceo@hq360.space">Need help accessing your report?</a>
      </section>
    </div>
  );
}

type Interest = { finding_id: string; author_interest: string; question?: string };
export function PrivateAuditLoader({ slug }: { slug: string }) {
  const [data, setData] = useState<{
    report: ReportData;
    versionId: string;
    interests: Interest[];
  } | null>(null);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/private-audit?slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.replace("/author-audit");
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) {
          setData(body);
          void auditRequest({ action: "event", event: "opened" }).catch(() => {});
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to load your audit.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [slug]);
  useEffect(() => {
    if (!data) return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const response = await fetch(`/api/private-audit?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.replace("/author-audit");
        return;
      }
      if (response.ok) {
        const result = await response.json();
        setUpdated(result.versionId !== data.versionId);
      }
    };
    const listener = () => {
      void check().catch(() => {});
    };
    window.addEventListener("focus", listener);
    return () => window.removeEventListener("focus", listener);
  }, [data, slug]);
  if (error)
    return (
      <div className="pa-loading" role="alert">
        {error}
        <a href="/author-audit">Return to private access</a>
      </div>
    );
  if (!data)
    return (
      <div className="pa-loading" role="status">
        Preparing your private audit…
      </div>
    );
  return (
    <>
      {updated && (
        <div className="pa-update">
          Updated audit available.{" "}
          <button onClick={() => window.location.reload()}>View update</button>
        </div>
      )}
      <PrivateAuditReport
        report={data.report}
        versionId={data.versionId}
        slug={slug}
        initialInterests={data.interests}
      />
    </>
  );
}

const sections = [
  ["overview", "Overview"],
  ["strengths", "Strengths"],
  ["visibility", "Visibility"],
  ["journey", "Reader journey"],
  ["comparables", "Market comparables"],
  ["findings", "Priority findings"],
  ["evidence", "Evidence"],
  ["moves", "3 moves"],
  ["roadmap", "30-day plan"],
  ["sources", "Sources"],
];
const pretty = (s: string | null | undefined) => (s || "Unable to verify").replace(/_/g, " ");
/** One clean sentence for a collapsed summary — the full text stays
 * available once the section is expanded. */
function firstSentence(text?: string | null, max = 160) {
  if (!text) return "";
  const clean = text.trim();
  const cut = clean.search(/[.!?](\s|$)/);
  const sentence = cut > 0 ? clean.slice(0, cut + 1) : clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}
function safeUrl(url: string | null | undefined) {
  try {
    const parsed = new URL(url ?? "");
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
function Sources({ urls, date }: { urls: string[]; date?: string | null }) {
  return (
    <div className="pa-sources">
      {urls.filter(safeUrl).map((url, i) => (
        <a key={url} href={safeUrl(url)} target="_blank" rel="noreferrer">
          Source {i + 1} ↗
        </a>
      ))}
      {date && <small>Verified / retrieved {new Date(date).toLocaleDateString()}</small>}
    </div>
  );
}
function Detail({ label, value }: { label: string; value?: string | null | undefined }) {
  return value ? (
    <div className="pa-detail">
      <h4>{label}</h4>
      <p>{value}</p>
    </div>
  ) : null;
}
export function PrivateAuditReport({
  report: r,
  versionId,
  slug,
  preview = false,
  initialInterests = [],
}: {
  report: ReportData;
  versionId: string;
  slug: string;
  preview?: boolean;
  initialInterests?: Interest[];
}) {
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [interests, setInterests] = useState(initialInterests);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [questionFor, setQuestionFor] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [evidence, setEvidence] = useState<string | null>(null);
  const [journeyStage, setJourneyStage] = useState<string | null>(null);
  const [allSources, setAllSources] = useState(false);
  function track(event: string, target?: string) {
    if (!preview) void auditRequest({ action: "event", event, target }).catch(() => {});
  }
  async function express(ids: string[], interest: string) {
    if (preview || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      await auditRequest({
        action: "interest",
        versionId,
        ids,
        interest,
        question: interest === "question" ? question : undefined,
      });
      setInterests((current) => [
        ...current,
        ...ids.map((id) => ({ finding_id: id, author_interest: interest })),
      ]);
      setFeedback(
        interest === "saved"
          ? "Saved to your audit."
          : "Sent to HQ360. Your team can see this alongside your audit.",
      );
      setQuestionFor(null);
      setQuestion("");
      if (interest === "help") setSelected([]);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const categories = [...new Set(r.findings.map((f) => f.category || f.section))];
  const pdfUrl = preview
    ? `/api/admin/author-audits/${slug}/publishing?version=${versionId}&format=pdf`
    : `/api/private-audit?slug=${encodeURIComponent(slug)}&format=pdf`;
  const empty = <p className="pa-empty">No approved material is included in this version.</p>;

  const attentionCount = r.findings.filter((f) =>
    ["critical_issue", "needs_attention"].includes(f.status),
  ).length;
  const platformsExamined = new Set(r.sourcesReviewed.map((s) => s.type)).size;
  const depthStats: [string, number][] = [
    ["Sources reviewed", r.sourcesReviewed.length],
    ["Platforms examined", platformsExamined],
    ["Comparable titles researched", r.comparables.length],
    ["Verified strengths", r.strengths.length],
  ];
  const sourceCategoryCounts = Object.entries(
    r.sourcesReviewed.reduce<Record<string, number>>((acc, s) => {
      const key = pretty(s.type);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <article className="private-audit-report">
      <header className="pa-header">
        <Logo size={38} />
        <span>Private intelligence / HQ360</span>
        {preview ? (
          <b>Author preview</b>
        ) : (
          <button
            onClick={async () => {
              try {
                await auditRequest({ action: "logout" });
                window.location.assign("/author-audit");
              } catch {
                setFeedback("Could not sign out. Please try again.");
              }
            }}
          >
            Sign out
          </button>
        )}
      </header>
      <section className="pa-hero">
        <p className="pa-eyebrow">Author visibility & growth audit</p>
        <p>Prepared specifically for</p>
        <h1>{r.author.name}</h1>
        <h2>{r.book.title}</h2>
        <div className="pa-meta">
          <span>{r.preparedDate}</span>
          <span>Verified & reviewed by HQ360</span>
        </div>
        <a className="pa-button" href={pdfUrl}>
          Download PDF ↓
        </a>
        {depthStats.some(([, n]) => n > 0) && (
          <div className="pa-depth">
            {depthStats.map(([label, n]) => (
              <div className="pa-depth-stat" key={label}>
                <strong>{n}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="pa-glance">
        {r.executiveAssessment?.priorityFirst && (
          <div className="pa-glance-conclusion">
            <h3>Main conclusion</h3>
            <p>{r.executiveAssessment.priorityFirst}</p>
          </div>
        )}
        <div className="pa-glance-item">
          <h3>Verified strengths</h3>
          <p>
            {r.strengths.length} confirmed strength{r.strengths.length === 1 ? "" : "s"} to build
            on.
          </p>
          <a href="#strengths" onClick={() => track("section", "strengths")}>
            View strengths ↗
          </a>
        </div>
        <div className="pa-glance-item">
          <h3>Priority findings</h3>
          <p>
            {r.findings.length} reviewed, {attentionCount} needing attention.
          </p>
          <a href="#findings" onClick={() => track("section", "findings")}>
            View findings ↗
          </a>
        </div>
        <div className="pa-glance-item">
          <h3>The 3 moves</h3>
          <p className="pa-glance-pill-row">
            {r.moves.map((m) => (
              <span className="pa-mini-badge" key={m.id}>
                {m.title.length > 34 ? `${m.title.slice(0, 34)}…` : m.title}
              </span>
            ))}
          </p>
          <a href="#moves" onClick={() => track("section", "moves")}>
            View the 3 moves ↗
          </a>
        </div>
        <div className="pa-glance-item">
          <h3>30-day plan</h3>
          <p>{r.roadmap.length} scheduled actions across 4 weeks.</p>
          <a href="#roadmap" onClick={() => track("section", "roadmap")}>
            View the plan ↗
          </a>
        </div>
      </div>
      <nav className="pa-nav" aria-label="Report sections">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={() => track("section", id)}>
            {label}
          </a>
        ))}
      </nav>
      <div className="pa-body">
        <section id="overview">
          <p className="pa-eyebrow">01 / Perspective</p>
          <h2>Your audit at a glance</h2>
          {r.executiveAssessment ? (
            <div className="pa-grid">
              {[
                ["What is already working", r.executiveAssessment.whatIsWorking],
                ["Most important opportunities", r.executiveAssessment.strongestOpportunities],
                ["Where the journey breaks", r.executiveAssessment.journeyBreaks],
                ["Key market pattern", r.executiveAssessment.comparablePatterns],
                ["What HQ360 would address first", r.executiveAssessment.priorityFirst],
                ["What to preserve", r.executiveAssessment.doNotChange],
                ["What remains unknown", r.executiveAssessment.unknowns],
              ].map(([label, value]) => (
                <Detail key={label} label={label ?? "Assessment"} value={value} />
              ))}
            </div>
          ) : (
            empty
          )}
        </section>
        <section id="strengths">
          <p className="pa-eyebrow">02 / Build on what works</p>
          <h2>Your verified strengths</h2>
          <div className="pa-grid">
            {r.strengths.map((s) => (
              <div className="pa-card" key={s.id}>
                <span className="pa-badge pa-badge-brand">Verified & approved</span>
                <h3>{s.title}</h3>
                <p>{s.observation}</p>
                <Detail label="Evidence" value={s.evidence} />
                <Detail label="HQ360 approach" value={pretty(s.disposition)} />
                <Sources urls={s.source_urls} date={s.retrieved_at} />
              </div>
            ))}
          </div>
          {!r.strengths.length && empty}
        </section>
        <section id="visibility">
          <p className="pa-eyebrow">03 / Visibility landscape</p>
          <h2>Where readers encounter you</h2>
          <p className="pa-lede">Select an area to explore its reviewed findings.</p>
          <div className="pa-landscape">
            {categories.map((c) => {
              const rows = r.findings.filter((f) => (f.category || f.section) === c);
              const status = rows.some((f) =>
                ["critical_issue", "needs_attention"].includes(f.status),
              )
                ? "Needs attention"
                : rows.some((f) => f.status === "opportunity_identified")
                  ? "Opportunity"
                  : rows.every((f) => f.status === "unable_to_verify")
                    ? "Unable to verify"
                    : "Strong / healthy";
              return (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(category === c ? "" : c);
                    track("section", "visibility");
                  }}
                >
                  <strong>{pretty(c)}</strong>
                  <small>{status}</small>
                </button>
              );
            })}
          </div>
          {category && (
            <div className="pa-card">
              <h3>{pretty(category)}</h3>
              {r.findings
                .filter((f) => (f.category || f.section) === category)
                .map((f) => (
                  <p key={f.id}>
                    <a href={`#finding-${f.id}`}>{f.title || f.observation} →</a>
                  </p>
                ))}
            </div>
          )}
        </section>
        <section id="journey">
          <p className="pa-eyebrow">04 / From discovery to connection</p>
          <h2>The reader journey</h2>
          <p className="pa-lede">Select a stage to see HQ360's observation and evidence.</p>
          <div className="pa-journey-track">
            {READER_JOURNEY_STAGE_ORDER.map((stage) => {
              const s = r.readerJourney.find((x) => x.stage === stage);
              const nodeClass = !s
                ? ""
                : ["critical_issue" as string, "needs_attention"].includes(s.status)
                  ? "is-attention"
                  : ["strong", "healthy"].includes(s.status)
                    ? "is-strong"
                    : "";
              const open = journeyStage === stage;
              return (
                <div className="pa-journey-stage" key={stage}>
                  <span className={`pa-journey-node ${nodeClass}`} aria-hidden />
                  <button
                    onClick={() => {
                      setJourneyStage(open ? null : stage);
                      track("section", "journey");
                    }}
                    aria-expanded={open}
                  >
                    <strong>{READER_JOURNEY_STAGE_LABEL[stage]}</strong>
                    <span className="pa-badge">{s ? pretty(s.status) : "Unable to verify"}</span>
                  </button>
                  {open && (
                    <div className="pa-journey-panel">
                      {s ? (
                        <>
                          <Detail label="HQ360 observation" value={s.observation} />
                          <Detail label="Friction" value={s.friction} />
                          <Detail label="Recommendation" value={s.recommendation} />
                          <Detail label="Evidence" value={s.evidence} />
                          <Sources urls={s.source_urls} date={s.retrieved_at} />
                        </>
                      ) : (
                        <p>This stage has no approved evidence in this version.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section id="comparables">
          <p className="pa-eyebrow">05 / Market context</p>
          <h2>Comparable authors & books</h2>
          <p className="pa-lede">
            Observable approaches in verified comparable work, presented without ranking authors.
          </p>
          {r.comparables.length > 0 ? (
            <div className="pa-matrix-wrap">
              <table className="pa-matrix">
                <thead>
                  <tr>
                    <th>Author / book</th>
                    <th>Why comparable</th>
                    <th>Positioning</th>
                    <th>Reader pathway / owned audience</th>
                    <th>Media & content</th>
                    <th>Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {r.comparables.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.author}
                        {c.book ? <br /> : null}
                        {c.book}
                      </td>
                      <td>{c.why_comparable}</td>
                      <td>{c.positioning_notes || "—"}</td>
                      <td>
                        {[c.reader_pathway_notes, c.newsletter_notes].filter(Boolean).join(" ") ||
                          "—"}
                      </td>
                      <td>
                        {[c.media_notes, c.content_strategy_notes].filter(Boolean).join(" ") ||
                          "—"}
                      </td>
                      <td>
                        <Sources urls={c.source_urls} date={c.retrieved_at} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            empty
          )}
          {r.executiveAssessment?.comparablePatterns && (
            <div className="pa-pattern">
              <h4>Pattern HQ360 noticed</h4>
              <p>{r.executiveAssessment.comparablePatterns}</p>
            </div>
          )}
        </section>
        <section id="findings">
          <p className="pa-eyebrow">06 / What deserves attention</p>
          <h2>Priority findings</h2>
          <p className="pa-lede">Tap a finding to see the full evidence and recommendation.</p>
          {r.findings.map((f) => (
            <details
              id={`finding-${f.id}`}
              key={f.id}
              className="pa-finding"
              onToggle={(e) => {
                if (e.currentTarget.open) track("finding", f.id);
              }}
            >
              <summary>
                <div className="pa-finding-summary-text">
                  <h3>{f.title || pretty(f.category || f.section)}</h3>
                  <div>
                    <span className="pa-badge pa-badge-brand">{pretty(f.priority)}</span>
                    <span
                      className={
                        ["critical_issue", "needs_attention"].includes(f.status)
                          ? "pa-badge pa-badge-attention"
                          : "pa-badge"
                      }
                    >
                      {pretty(f.status)}
                    </span>
                  </div>
                  <p className="pa-finding-oneliner">{firstSentence(f.observation)}</p>
                  {f.why_it_matters && (
                    <p className="pa-finding-oneliner">{firstSentence(f.why_it_matters)}</p>
                  )}
                </div>
                <span className="pa-finding-chevron" />
              </summary>
              <div className="pa-finding-body">
                <Detail label="What HQ360 observed" value={f.observation} />
                <Detail label="Why it matters" value={f.why_it_matters} />
                <Detail
                  label={
                    f.status === "unable_to_verify" ? "Requires confirmation" : "Recommended action"
                  }
                  value={f.recommendation}
                />
                <Sources urls={f.source_urls} date={f.retrieved_at} />
                {!preview && (
                  <div className="pa-actions">
                    <button disabled={busy} onClick={() => void express([f.id], "saved")}>
                      {interests.some(
                        (i) => i.finding_id === f.id && i.author_interest === "saved",
                      )
                        ? "Saved ✓"
                        : "Save this"}
                    </button>
                    <button disabled={busy} onClick={() => void express([f.id], "help")}>
                      {interests.some(
                        (i) => i.finding_id === f.id && i.author_interest === "help",
                      )
                        ? "Help requested ✓"
                        : "I want help with this"}
                    </button>
                    <button onClick={() => setQuestionFor(questionFor === f.id ? null : f.id)}>
                      I have a question
                    </button>
                  </div>
                )}
                {questionFor === f.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void express([f.id], "question");
                    }}
                  >
                    <label>
                      Your question
                      <textarea
                        required
                        maxLength={2000}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                    </label>
                    <button disabled={busy}>Send question</button>
                  </form>
                )}
              </div>
            </details>
          ))}
          {!r.findings.length && empty}
        </section>
        <section id="evidence">
          <p className="pa-eyebrow">07 / The research behind the recommendations</p>
          <h2>Evidence gallery</h2>
          <div className="pa-grid">
            {r.evidenceAssets.map((a) => (
              <div className="pa-card" key={a.id}>
                <button
                  className="pa-evidence"
                  onClick={() => {
                    setEvidence(evidence === a.id ? null : a.id);
                    track("evidence", a.id);
                  }}
                >
                  {safeUrl(a.storage_url) || a.storage_url.startsWith("/api/private-audit") ? (
                    <img
                      src={a.storage_url}
                      alt={a.caption || "Reviewed audit evidence"}
                      loading="lazy"
                    />
                  ) : (
                    "Image unavailable"
                  )}
                  <span>{evidence === a.id ? "Close expanded view" : "Expand evidence"}</span>
                </button>
                {evidence === a.id && (
                  <a
                    href={safeUrl(a.storage_url) || a.storage_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open full-size evidence ↗
                  </a>
                )}
                <Detail
                  label="What HQ360 observed / what to notice"
                  value={a.caption || "No caption supplied"}
                />
                <Sources urls={a.source ? [a.source] : []} date={a.asset_date} />
                <span className="pa-badge pa-badge-brand">Approved for client report</span>
              </div>
            ))}
          </div>
          {!r.evidenceAssets.length && empty}
        </section>
        <section id="moves" className="pa-moves">
          <p className="pa-eyebrow">08 / Focus before momentum</p>
          <h2>The 3 moves HQ360 would make first</h2>
          {r.moves.map((m) => (
            <div className="pa-move" key={m.id}>
              <span className="pa-move-number">0{m.rank}</span>
              <div>
                <h3>{m.title}</h3>
                <Detail label="What we found" value={m.what_we_found} />
                <Detail label="What we would change" value={m.what_we_would_change} />
                <Detail label="Why this comes first" value={m.why_first} />
                <Detail label="What it enables next" value={m.enables_next} />
                <Detail label="Success indicator" value={m.success_indicator} />
                <Detail label="Evidence" value={m.evidence} />
                {m.based_on_finding_ids.map((id) => (
                  <a key={id} href={`#finding-${id}`}>
                    Related finding ↗{" "}
                  </a>
                ))}
              </div>
            </div>
          ))}
          {!r.moves.length && (
            <p style={{ color: "inherit" }}>No approved moves are included in this version.</p>
          )}
        </section>
        <section id="roadmap">
          <p className="pa-eyebrow">09 / Put the priorities to work</p>
          <h2>Your 30-day plan</h2>
          <div className="pa-grid">
            {[1, 2, 3, 4].map((week) => {
              const items = r.roadmap.filter((a) => a.week === week);
              return (
                <div className="pa-week-card" key={week}>
                  <h3>
                    Week {week}
                    {items.length > 0 && <span className="pa-week-count">{items.length}</span>}
                  </h3>
                  {items.map((a) => (
                    <div key={a.id} className="pa-task">
                      <h4>{a.action}</h4>
                      <Detail label="Why" value={a.reason} />
                      <Detail label="Requires confirmation / dependency" value={a.dependency} />
                      <Detail label="Done when" value={a.completion_indicator} />
                      {a.based_on_finding_ids.map((id) => (
                        <a key={id} href={`#finding-${id}`}>
                          Related finding ↗{" "}
                        </a>
                      ))}
                    </div>
                  ))}
                  {!items.length && <p>No approved actions scheduled for this week.</p>}
                </div>
              );
            })}
          </div>
        </section>
        <section id="sources">
          <p className="pa-eyebrow">10 / Source appendix</p>
          <h2>Research you can follow</h2>
          {sourceCategoryCounts.length > 0 ? (
            <>
              <div className="pa-source-summary-grid">
                {sourceCategoryCounts.map(([label, count]) => (
                  <div className="pa-source-summary-item" key={label}>
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <button className="pa-sources-toggle" onClick={() => setAllSources(!allSources)}>
                {allSources
                  ? "Hide individual sources"
                  : `View all ${r.sourcesReviewed.length} sources →`}
              </button>
              {allSources && (
                <div className="pa-sources-full">
                  {r.sourcesReviewed.map((s, index) => (
                    <div className="pa-source" key={index}>
                      <h4>{s.name}</h4>
                      <p>
                        {s.type} · {pretty(s.verificationStatus)}
                      </p>
                      <Sources urls={s.url ? [s.url] : []} date={s.retrievedAt} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            empty
          )}
        </section>
        {!preview && (
          <section className="pa-final">
            <h2>Ready to act on the priorities?</h2>
            <p>
              Your audit identifies what deserves attention first. Select the areas you’d like HQ360
              to help implement.
            </p>
            <details>
              <summary>Choose what HQ360 can help with</summary>
              {r.findings
                .filter((f) => f.recommendation)
                .map((f) => (
                  <label className="pa-check" key={f.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(f.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked ? [...ids, f.id] : ids.filter((id) => id !== f.id),
                        )
                      }
                    />
                    {f.title || f.observation}
                  </label>
                ))}
              <button
                disabled={busy || !selected.length}
                onClick={() => void express(selected, "help")}
              >
                Send to HQ360
              </button>
            </details>
          </section>
        )}
        {feedback && (
          <div className="pa-feedback" role="status">
            {feedback}
            <button onClick={() => setFeedback("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}
        <footer>Prepared by HQ360 · Private and confidential · {r.preparedDate}</footer>
      </div>
    </article>
  );
}
