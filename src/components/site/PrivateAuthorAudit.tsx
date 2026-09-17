import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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

/* ---------------------------------------------------------- helpers */
const SECTIONS: [string, string][] = [
  ["overview", "Overview"],
  ["strengths", "Strengths"],
  ["visibility", "Visibility"],
  ["journey", "Journey"],
  ["comparables", "Market"],
  ["findings", "Findings"],
  ["evidence", "Evidence"],
  ["moves", "3 Moves"],
  ["plan", "Plan"],
  ["sources", "Sources"],
];
const pretty = (s: string | null | undefined) => (s || "Unable to verify").replace(/_/g, " ");
function firstSentence(text?: string | null, max = 150) {
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

/** Reveal-on-scroll wrapper — pure IntersectionObserver, no animation
 * library. Respects prefers-reduced-motion via the CSS itself. */
function Reveal({ children, as: As = "div" }: { children: ReactNode; as?: "div" | "section" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const As2 = As as "div";
  return (
    <As2 ref={ref} className={`pa-reveal${visible ? " is-visible" : ""}`}>
      {children}
    </As2>
  );
}

/** Counts up a number the first time it scrolls into view. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 700;
        function tick(now: number) {
          const p = Math.min(1, (now - start) / duration);
          setDisplay(Math.round(value * (1 - (1 - p) ** 3)));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return <span ref={ref}>{display}</span>;
}

function Sources({ urls, date }: { urls: string[]; date?: string | null }) {
  const clean = urls.filter(safeUrl);
  if (!clean.length && !date) return null;
  return (
    <p className="pa-related">
      {clean.map((url, i) => (
        <a key={url} href={safeUrl(url)} target="_blank" rel="noreferrer">
          Source {i + 1} ↗{" "}
        </a>
      ))}
      {date && <span>· Verified {new Date(date).toLocaleDateString()}</span>}
    </p>
  );
}
function Block({ label, value }: { label: string; value?: string | null | undefined }) {
  return value ? (
    <div className="pa-block">
      <h4>{label}</h4>
      <p>{value}</p>
    </div>
  ) : null;
}

type SourceRow = {
  bucket: string;
  name: string;
  type: string;
  url: string | null | undefined;
  retrievedAt: string | null | undefined;
  verificationStatus: string;
};
function bucketFor(name: string) {
  const n = name.toLowerCase();
  if (n.includes("amazon")) return "Amazon";
  if (n.includes("goodreads")) return "Goodreads";
  if (n.includes("website") || n.includes("newsletter") || n.includes("owned")) return "Website";
  if (n.includes("media") || n.includes("podcast") || n.includes("press")) return "Media";
  if (n.includes("social")) return "Social";
  return "Other";
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
  const [openMetric, setOpenMetric] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [interests, setInterests] = useState(initialInterests);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [questionFor, setQuestionFor] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [journeyStage, setJourneyStage] = useState<string | null>(null);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [activeMove, setActiveMove] = useState(0);
  const [mobileComparable, setMobileComparable] = useState(0);
  const [evidenceItem, setEvidenceItem] = useState<ReportData["evidenceAssets"][number] | null>(
    null,
  );
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [ctaPath, setCtaPath] = useState<"diy" | "help" | "recommend" | null>(null);
  const [activeSection, setActiveSection] = useState("overview");

  const evidenceDialogRef = useRef<HTMLDialogElement>(null);
  const sourceDialogRef = useRef<HTMLDialogElement>(null);
  const journeyRailRef = useRef<HTMLDivElement>(null);

  function track(event: string, target?: string) {
    if (!preview) void auditRequest({ action: "event", event, target }).catch(() => {});
  }
  async function express(ids: string[], interest: string) {
    if (preview || busy || !ids.length) return;
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

  // Scrollspy across the numbered sections.
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          const top = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
          if (top) setActiveSection(top.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [r]);

  // Reader-journey scroll-linked fill: progress = highest stage seen.
  useEffect(() => {
    const nodes = READER_JOURNEY_STAGE_ORDER.map((s) =>
      document.getElementById(`journey-${s}`),
    ).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = nodes.indexOf(entry.target as HTMLElement);
          setJourneyProgress((p) => Math.max(p, ((idx + 1) / nodes.length) * 100));
        });
      },
      { threshold: 0.6 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [r]);

  useEffect(() => {
    const dim = window.matchMedia("(min-width: 960px)").matches ? "width" : "height";
    if (journeyRailRef.current) {
      const bar = journeyRailRef.current.querySelector("i") as HTMLElement | null;
      if (bar) bar.style[dim] = `${journeyProgress}%`;
    }
  }, [journeyProgress]);

  useEffect(() => {
    if (evidenceItem) evidenceDialogRef.current?.showModal();
    else evidenceDialogRef.current?.close();
  }, [evidenceItem]);
  useEffect(() => {
    if (sourceOpen) sourceDialogRef.current?.showModal();
    else sourceDialogRef.current?.close();
  }, [sourceOpen]);

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
    ["Verified sources", r.sourcesReviewed.length],
    ["Platforms examined", platformsExamined],
    ["Market comparables", r.comparables.length],
  ];

  const sourceRows: SourceRow[] = useMemo(() => {
    const fromReviewed = r.sourcesReviewed.map((s) => ({
      bucket: bucketFor(s.name),
      name: s.name,
      type: s.type,
      url: s.url,
      retrievedAt: s.retrievedAt,
      verificationStatus: s.verificationStatus,
    }));
    const fromComparables = r.comparables.map((c) => ({
      bucket: "Market comparables",
      name: `${c.author}${c.book ? ` — ${c.book}` : ""}`,
      type: "Comparable title",
      url: c.source_urls[0],
      retrievedAt: c.retrieved_at,
      verificationStatus: "verified",
    }));
    return [...fromReviewed, ...fromComparables];
  }, [r]);
  const sourceCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sourceRows.forEach((s) => counts.set(s.bucket, (counts.get(s.bucket) ?? 0) + 1));
    return [...counts.entries()];
  }, [sourceRows]);
  const filteredSourceRows =
    sourceFilter === "All" ? sourceRows : sourceRows.filter((s) => s.bucket === sourceFilter);

  const recommendableFindings = r.findings.filter((f) => f.recommendation);
  const moveFindingIds = [...new Set(r.moves.flatMap((m) => m.based_on_finding_ids))];

  return (
    <article className="private-audit-report">
      <header className="pa-header">
        <Logo size={34} />
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

      {/* ------------------------------------------------------ hero */}
      <section className="pa-hero">
        <div className="pa-hero-top">
          <span className="pa-signal-dot" aria-hidden />
          01 / Private research dossier
        </div>
        <p className="pa-hero-name">{r.author.name}</p>
        <p className="pa-hero-book">{r.book.title}</p>
        <div className="pa-hero-meta">
          <span>Prepared specifically for {r.author.name}</span>
          <span>{r.preparedDate}</span>
          <span>Human reviewed by HQ360</span>
        </div>
        <div className="pa-hero-actions">
          <a className="pa-btn-brand" href={pdfUrl}>
            Download PDF ↓
          </a>
          <a className="pa-explore" href="#overview">
            Explore your audit ↓
          </a>
        </div>
        {depthStats.some(([, n]) => n > 0) && (
          <div className="pa-depth">
            {depthStats.map(([label, n]) => (
              <div className="pa-depth-stat" key={label}>
                <strong>
                  <CountUp value={n} />
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* -------------------------------------------------- navigator */}
      <div className="pa-navwrap">
        <div className="pa-progress">
          <i
            style={{
              width: `${(SECTIONS.findIndex(([id]) => id === activeSection) / (SECTIONS.length - 1)) * 100}%`,
            }}
          />
        </div>
        <nav className="pa-nav" aria-label="Report sections">
          {SECTIONS.map(([id, label], i) => (
            <button
              key={id}
              className={activeSection === id ? "is-active" : ""}
              onClick={() => {
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                track("section", id);
              }}
            >
              <span className="pa-nav-index">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="pa-body">
        {/* -------------------------------------------------- overview */}
        <section id="overview" className="pa-section">
          <Reveal>
            <p className="pa-kicker">01 / The short version</p>
            <h2 className="pa-h2">If you only read one part, read this.</h2>
          </Reveal>
          <Reveal>
            <div className="pa-metrics">
              {(
                [
                  [
                    "strengths",
                    "What's working",
                    r.strengths.length,
                    "verified strengths",
                    "Confirmed assets already working in your favor — worth protecting, not fixing.",
                  ],
                  [
                    "attention",
                    "Needs attention",
                    attentionCount,
                    "priority findings",
                    "Findings HQ360 flagged as the areas most worth your attention right now.",
                  ],
                  [
                    "moves",
                    "We'd do first",
                    r.moves.length,
                    "strategic moves",
                    "The moves HQ360 would make first, in order, if this were our book.",
                  ],
                  [
                    "window",
                    "Action window",
                    30,
                    "days",
                    "A realistic first month to act on the highest-priority findings.",
                  ],
                ] as [string, string, number, string, string][]
              ).map(([key, label, value, unit, explain]) => (
                <button
                  key={key}
                  className={`pa-metric${openMetric === key ? " is-open" : ""}`}
                  onClick={() => setOpenMetric(openMetric === key ? null : key)}
                  aria-expanded={openMetric === key}
                >
                  <strong>
                    <CountUp value={value} />
                  </strong>
                  <span>
                    {label} · {unit}
                  </span>
                  <small>{explain}</small>
                </button>
              ))}
            </div>
          </Reveal>
          {r.executiveAssessment?.priorityFirst && (
            <Reveal>
              <div className="pa-conclusion">
                <h3>The main thing we found</h3>
                <p>{r.executiveAssessment.priorityFirst}</p>
              </div>
            </Reveal>
          )}
          {!r.executiveAssessment && empty}
        </section>

        {/* ------------------------------------------------- strengths */}
        <section id="strengths" className="pa-section">
          <Reveal>
            <p className="pa-kicker">02 / What you've already built</p>
            <h2 className="pa-h2">Not everything needs fixing.</h2>
            <p className="pa-sub">
              These are the assets worth protecting and building on — each one independently
              verified by HQ360.
            </p>
          </Reveal>
          <div className="pa-strength-grid">
            {r.strengths.map((s, i) => (
              <Reveal key={s.id}>
                <StrengthCard index={i + 1} strength={s} />
              </Reveal>
            ))}
          </div>
          {!r.strengths.length && empty}
        </section>

        {/* ------------------------------------------------ visibility */}
        <section id="visibility" className="pa-section">
          <Reveal>
            <p className="pa-kicker">03 / The visibility signal</p>
            <h2 className="pa-h2">Where readers actually encounter you.</h2>
            <p className="pa-sub">Select a signal to see what HQ360 found there.</p>
          </Reveal>
          <div className="pa-signal-grid">
            {categories.map((c) => {
              const rows = r.findings.filter((f) => (f.category || f.section) === c);
              const state = rows.some((f) =>
                ["critical_issue", "needs_attention"].includes(f.status),
              )
                ? "attention"
                : rows.some((f) => f.status === "opportunity_identified")
                  ? "opportunity"
                  : rows.every((f) => f.status === "unable_to_verify")
                    ? "unverified"
                    : "strong";
              const stateLabel = {
                attention: "Needs attention",
                opportunity: "Opportunity",
                unverified: "Unable to verify",
                strong: "Strong / healthy",
              }[state];
              return (
                <button
                  key={c}
                  className="pa-signal-node"
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(category === c ? "" : c);
                    track("section", "visibility");
                  }}
                >
                  <strong>{pretty(c)}</strong>
                  <span className="pa-dot-label">
                    <span className={`pa-signal-dotstate ${state}`} aria-hidden />
                    {stateLabel}
                  </span>
                </button>
              );
            })}
          </div>
          {category && (
            <Reveal>
              <div className="pa-signal-detail">
                <h3>{pretty(category)}</h3>
                {r.findings
                  .filter((f) => (f.category || f.section) === category)
                  .map((f) => (
                    <a key={f.id} href={`#finding-${f.id}`}>
                      {f.title || firstSentence(f.observation)} →
                    </a>
                  ))}
              </div>
            </Reveal>
          )}
        </section>

        {/* --------------------------------------------------- journey */}
        <section id="journey" className="pa-section">
          <Reveal>
            <p className="pa-kicker">04 / Follow the reader</p>
            <h2 className="pa-h2">
              From discovering {r.author.name.split(" ")[0]} to becoming part of her audience.
            </h2>
          </Reveal>
          <div className="pa-journey-scroller">
            <div className="pa-journey-track">
              <div className="pa-journey-rail" ref={journeyRailRef}>
                <i />
              </div>
              {READER_JOURNEY_STAGE_ORDER.map((stage) => {
                const s = r.readerJourney.find((x) => x.stage === stage);
                const nodeClass = !s
                  ? ""
                  : ["critical_issue", "needs_attention"].includes(s.status)
                    ? "is-attention"
                    : ["strong", "healthy"].includes(s.status)
                      ? "is-strong"
                      : "";
                const open = journeyStage === stage;
                return (
                  <div className="pa-journey-stage" id={`journey-${stage}`} key={stage}>
                    <span className={`pa-journey-node ${nodeClass}`} aria-hidden />
                    <button
                      onClick={() => {
                        setJourneyStage(open ? null : stage);
                        track("section", "journey");
                      }}
                      aria-expanded={open}
                    >
                      <strong>{READER_JOURNEY_STAGE_LABEL[stage]}</strong>
                      <span className="pa-journey-oneliner">
                        {s ? firstSentence(s.observation, 70) : "Unable to verify"}
                      </span>
                    </button>
                    {open && (
                      <div className="pa-journey-panel">
                        {s ? (
                          <>
                            <Block label="What we observed" value={s.observation} />
                            <Block label="Friction" value={s.friction} />
                            <Block label="Recommendation" value={s.recommendation} />
                            <Block label="Evidence" value={s.evidence} />
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
          </div>
        </section>

        {/* ----------------------------------------------- comparables */}
        <section id="comparables" className="pa-section">
          <Reveal>
            <p className="pa-kicker">05 / How the market shows up</p>
            <h2 className="pa-h2">How similar books present themselves.</h2>
            <p className="pa-sub pa-why-these">
              These titles were selected because of a genuine shared category or founder story — not
              ranked, and never invented.
            </p>
          </Reveal>
          {r.comparables.length > 0 ? (
            <>
              <div className="pa-matrix-wrap">
                <table className="pa-matrix">
                  <thead>
                    <tr>
                      <th>Author / book</th>
                      <th>Why comparable</th>
                      <th>Website</th>
                      <th>Goodreads</th>
                      <th>Positioning & pathway</th>
                      <th>Sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.comparables.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.author}
                          {c.book ? (
                            <>
                              <br />
                              <span style={{ fontWeight: 400 }}>{c.book}</span>
                            </>
                          ) : null}
                        </td>
                        <td>{c.why_comparable}</td>
                        <td>
                          <span className={`pa-state ${c.website_url ? "present" : ""}`}>
                            {c.website_url ? "Present" : "Not observed"}
                          </span>
                        </td>
                        <td>
                          <span className={`pa-state ${c.goodreads_url ? "present" : ""}`}>
                            {c.goodreads_url ? "Present" : "Not observed"}
                          </span>
                        </td>
                        <td>
                          {[c.positioning_notes, c.reader_pathway_notes, c.media_notes]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td>
                          <Sources urls={c.source_urls} date={c.retrieved_at} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pa-comparable-select">
                <select
                  value={mobileComparable}
                  onChange={(e) => setMobileComparable(Number(e.target.value))}
                >
                  {r.comparables.map((c, i) => (
                    <option key={c.id} value={i}>
                      Compare with {c.author}
                    </option>
                  ))}
                </select>
                {r.comparables[mobileComparable] && (
                  <dl className="pa-comparable-card">
                    <dt>Why comparable</dt>
                    <dd>{r.comparables[mobileComparable].why_comparable}</dd>
                    <dt>Website</dt>
                    <dd>
                      {r.comparables[mobileComparable].website_url ? "Present" : "Not observed"}
                    </dd>
                    <dt>Goodreads</dt>
                    <dd>
                      {r.comparables[mobileComparable].goodreads_url ? "Present" : "Not observed"}
                    </dd>
                    <dt>Positioning & pathway</dt>
                    <dd>
                      {[
                        r.comparables[mobileComparable].positioning_notes,
                        r.comparables[mobileComparable].reader_pathway_notes,
                        r.comparables[mobileComparable].media_notes,
                      ]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </dd>
                  </dl>
                )}
              </div>
            </>
          ) : (
            empty
          )}
          {r.executiveAssessment?.comparablePatterns && (
            <Reveal>
              <div className="pa-pattern">
                <h4>The pattern we noticed</h4>
                <p>{r.executiveAssessment.comparablePatterns}</p>
              </div>
            </Reveal>
          )}
        </section>

        {/* -------------------------------------------------- findings */}
        <section id="findings" className="pa-section">
          <Reveal>
            <p className="pa-kicker">06 / Where we'd look next</p>
            <h2 className="pa-h2">The findings worth your attention.</h2>
            <p className="pa-sub">Tap any finding to see the full evidence and recommendation.</p>
          </Reveal>
          {r.findings.map((f, i) => (
            <details
              id={`finding-${f.id}`}
              key={f.id}
              className="pa-finding-row"
              onToggle={(e) => {
                if (e.currentTarget.open) track("finding", f.id);
              }}
            >
              <summary>
                <span className="pa-finding-num">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <h3>{f.title || pretty(f.category || f.section)}</h3>
                  <p className="pa-finding-oneliner">{firstSentence(f.observation)}</p>
                </span>
                <span
                  className={`pa-priority-tag ${["critical_issue", "needs_attention"].includes(f.status) ? "high" : "normal"}`}
                >
                  {pretty(f.priority)}
                </span>
                <span className="pa-finding-chevron" />
              </summary>
              <div className="pa-finding-body">
                <Block label="What we observed" value={f.observation} />
                <Block label="Why it matters" value={f.why_it_matters} />
                <Block
                  label={
                    f.status === "unable_to_verify" ? "Requires confirmation" : "What we recommend"
                  }
                  value={f.recommendation}
                />
                <Sources urls={f.source_urls} date={f.retrieved_at} />
                {!preview && (
                  <div
                    className="pa-actions"
                    style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                  >
                    <button
                      className="pa-explore-sources"
                      disabled={busy}
                      onClick={() => void express([f.id], "saved")}
                    >
                      {interests.some(
                        (it) => it.finding_id === f.id && it.author_interest === "saved",
                      )
                        ? "Saved ✓"
                        : "Save this"}
                    </button>
                    <button
                      className="pa-explore-sources"
                      disabled={busy}
                      onClick={() => void express([f.id], "help")}
                    >
                      {interests.some(
                        (it) => it.finding_id === f.id && it.author_interest === "help",
                      )
                        ? "Help requested ✓"
                        : "I want help with this"}
                    </button>
                    <button
                      className="pa-explore-sources"
                      onClick={() => setQuestionFor(questionFor === f.id ? null : f.id)}
                    >
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
                    <button className="pa-btn-brand" disabled={busy}>
                      Send question
                    </button>
                  </form>
                )}
              </div>
            </details>
          ))}
          {!r.findings.length && empty}
        </section>

        {/* -------------------------------------------------- evidence */}
        <section id="evidence" className="pa-section">
          <Reveal>
            <p className="pa-kicker">07 / The evidence room</p>
            <h2 className="pa-h2">See the research, not just the summary.</h2>
            <p className="pa-sub">Every image below was captured directly from the live source.</p>
          </Reveal>
          <div className="pa-evidence-grid">
            {r.evidenceAssets.map((a) => (
              <button
                key={a.id}
                className="pa-evidence-tile"
                onClick={() => {
                  setEvidenceItem(a);
                  track("evidence", a.id);
                }}
              >
                {safeUrl(a.storage_url) || a.storage_url.startsWith("/api/private-audit") ? (
                  <img
                    src={a.storage_url}
                    alt={a.caption || "Reviewed audit evidence"}
                    loading="lazy"
                  />
                ) : null}
                <span className="pa-evidence-meta">
                  <span>What HQ360 observed</span>
                  <p>{a.caption ? firstSentence(a.caption, 90) : "No caption supplied"}</p>
                </span>
              </button>
            ))}
          </div>
          {!r.evidenceAssets.length && empty}
          <dialog
            ref={evidenceDialogRef}
            className="pa-evidence-dialog"
            onClose={() => setEvidenceItem(null)}
          >
            {evidenceItem && (
              <div style={{ position: "relative" }}>
                <button
                  className="pa-dialog-close"
                  onClick={() => setEvidenceItem(null)}
                  aria-label="Close"
                >
                  ×
                </button>
                <img
                  src={evidenceItem.storage_url}
                  alt={evidenceItem.caption || "Audit evidence"}
                />
                <div className="pa-evidence-dialog-body">
                  <h3>What to notice</h3>
                  <p>{evidenceItem.caption || "No caption supplied."}</p>
                  <Sources
                    urls={evidenceItem.source ? [evidenceItem.source] : []}
                    date={evidenceItem.asset_date}
                  />
                </div>
              </div>
            )}
          </dialog>
        </section>

        {/* ----------------------------------------------------- moves */}
        <section id="moves" className="pa-section pa-moves">
          <Reveal>
            <p className="pa-kicker">08 / The strategic conclusion</p>
            <h2 className="pa-h2">If this were our book, we'd start here.</h2>
          </Reveal>
          {r.moves.length > 0 ? (
            <>
              <div className="pa-move-tabs">
                {r.moves.map((m, i) => (
                  <button
                    key={m.id}
                    className={`pa-move-tab${activeMove === i ? " is-active" : ""}`}
                    onClick={() => setActiveMove(i)}
                  >
                    0{m.rank} · {m.title.length > 28 ? `${m.title.slice(0, 28)}…` : m.title}
                  </button>
                ))}
              </div>
              {r.moves[activeMove] && (
                <div className="pa-move-stage">
                  <span className="pa-move-number">0{r.moves[activeMove].rank}</span>
                  <div>
                    <h3>{r.moves[activeMove].title}</h3>
                    <Block label="What we found" value={r.moves[activeMove].what_we_found} />
                    <Block
                      label="What we'd change"
                      value={r.moves[activeMove].what_we_would_change}
                    />
                    <Block label="Why this comes first" value={r.moves[activeMove].why_first} />
                    <Block label="What it unlocks" value={r.moves[activeMove].enables_next} />
                    <Block
                      label="Success indicator"
                      value={r.moves[activeMove].success_indicator}
                    />
                    {r.moves[activeMove].based_on_finding_ids.map((id) => (
                      <a key={id} href={`#finding-${id}`}>
                        Related finding ↗{" "}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "inherit" }}>No approved moves are included in this version.</p>
          )}
        </section>

        {/* ------------------------------------------------------ plan */}
        <section id="plan" className="pa-section">
          <Reveal>
            <p className="pa-kicker">09 / From audit to action</p>
            <h2 className="pa-h2">Your first 30 days.</h2>
          </Reveal>
          <div className="pa-week-grid">
            {[1, 2, 3, 4].map((week) => {
              const items = r.roadmap.filter((a) => a.week === week);
              return <WeekCard key={week} week={week} items={items} />;
            })}
          </div>
        </section>

        {/* --------------------------------------------------- sources */}
        <section id="sources" className="pa-section">
          <Reveal>
            <p className="pa-kicker">10 / Research you can verify</p>
            <h2 className="pa-h2">Every conclusion traces back to a source.</h2>
            <p className="pa-sub">
              Every major conclusion in this audit is connected to evidence reviewed by HQ360.
            </p>
          </Reveal>
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
              <button className="pa-explore-sources" onClick={() => setSourceOpen(true)}>
                Explore all {sourceRows.length} sources →
              </button>
              <dialog
                ref={sourceDialogRef}
                className="pa-source-dialog"
                onClose={() => setSourceOpen(false)}
              >
                <div className="pa-source-dialog-head" style={{ position: "relative" }}>
                  <button
                    className="pa-dialog-close"
                    onClick={() => setSourceOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>
                    Source explorer
                  </h3>
                  <div className="pa-source-filters">
                    {["All", ...sourceCategoryCounts.map(([l]) => l)].map((f) => (
                      <button
                        key={f}
                        className={sourceFilter === f ? "is-active" : ""}
                        onClick={() => setSourceFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pa-source-dialog-body">
                  {filteredSourceRows.map((s, i) => (
                    <div className="pa-source-row" key={i}>
                      <h4>{s.name}</h4>
                      <p>
                        {s.bucket} · {pretty(s.verificationStatus)}
                        {s.retrievedAt ? ` · ${new Date(s.retrievedAt).toLocaleDateString()}` : ""}
                      </p>
                      {safeUrl(s.url) && (
                        <a href={safeUrl(s.url)} target="_blank" rel="noreferrer">
                          Open source ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </dialog>
            </>
          ) : (
            empty
          )}
        </section>

        {/* ------------------------------------------------ final CTA */}
        {!preview && (
          <section className="pa-final">
            <Reveal>
              <p className="pa-kicker">11 / Next</p>
              <h2 className="pa-h2">What would you like to do with this?</h2>
            </Reveal>
            <div className="pa-cta-paths">
              <button
                className={`pa-cta-path${ctaPath === "diy" ? " is-active" : ""}`}
                onClick={() => setCtaPath(ctaPath === "diy" ? null : "diy")}
              >
                I'd like to handle these myself
              </button>
              <button
                className={`pa-cta-path${ctaPath === "help" ? " is-active" : ""}`}
                onClick={() => setCtaPath(ctaPath === "help" ? null : "help")}
              >
                I'd like HQ360's help with specific recommendations
              </button>
              <button
                className={`pa-cta-path${ctaPath === "recommend" ? " is-active" : ""}`}
                onClick={() => setCtaPath(ctaPath === "recommend" ? null : "recommend")}
              >
                I'd like HQ360 to recommend what to implement first
              </button>
            </div>
            {ctaPath === "diy" && (
              <p className="pa-sub">
                Understood — everything above stays available whenever you want to revisit it.
              </p>
            )}
            {ctaPath === "help" && (
              <div className="pa-cta-recs">
                {recommendableFindings.map((f) => (
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
                  className="pa-btn-brand pa-send-btn"
                  disabled={busy || !selected.length}
                  onClick={() => void express(selected, "help")}
                >
                  Send my selections to HQ360
                </button>
              </div>
            )}
            {ctaPath === "recommend" && (
              <div className="pa-cta-recs">
                <p className="pa-sub">
                  HQ360 will follow the priority already set by the 3 moves above.
                </p>
                <button
                  className="pa-btn-brand pa-send-btn"
                  disabled={busy || !moveFindingIds.length}
                  onClick={() => void express(moveFindingIds, "help")}
                >
                  Send to HQ360
                </button>
              </div>
            )}
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

function StrengthCard({
  index,
  strength: s,
}: {
  index: number;
  strength: ReportData["strengths"][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pa-strength">
      <span className="pa-strength-num">{String(index).padStart(2, "0")}</span>
      <h3>{s.title}</h3>
      <p>{firstSentence(s.observation, 130)}</p>
      <span className="pa-verified">✓ Verified</span>
      <button className="pa-why-link" onClick={() => setOpen(!open)}>
        {open ? "Hide detail ↑" : "Why this matters →"}
      </button>
      {open && (
        <div className="pa-strength-expand">
          <Block label="Full observation" value={s.observation} />
          <Block label="Evidence" value={s.evidence} />
          <Block label="HQ360 approach" value={pretty(s.disposition)} />
          <Sources urls={s.source_urls} date={s.retrieved_at} />
        </div>
      )}
    </div>
  );
}

function WeekCard({ week, items }: { week: number; items: ReportData["roadmap"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pa-week">
      <button className="pa-week-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="pa-week-label">Week {String(week).padStart(2, "0")}</span>
        <h3>{items[0]?.action ? firstSentence(items[0].action, 40) : "No scheduled actions"}</h3>
        <p>
          {items.length} action{items.length === 1 ? "" : "s"}
        </p>
        <span className="pa-week-count">{open ? "Hide week ↑" : "Explore week →"}</span>
      </button>
      {open && (
        <div className="pa-week-actions">
          {items.map((a) => (
            <div key={a.id} className="pa-action">
              <h4>{a.action}</h4>
              <Block label="Why" value={a.reason} />
              <Block label="Requires confirmation" value={a.dependency} />
              <Block label="Done when" value={a.completion_indicator} />
              {a.based_on_finding_ids.map((id) => (
                <a key={id} className="pa-related" href={`#finding-${id}`}>
                  Related finding ↗
                </a>
              ))}
            </div>
          ))}
          {!items.length && <p>No approved actions scheduled for this week.</p>}
        </div>
      )}
    </div>
  );
}
