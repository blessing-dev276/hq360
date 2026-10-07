import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Check, Sparkles } from "lucide-react";
import type { Industry } from "@/data/industries";
import { capabilitiesFor } from "@/data/capabilities";
import { PRINCIPLES } from "@/data/process";
import { Container } from "@/components/site/Primitives";
import { FaqSection } from "@/components/site/FaqSection";
import { ProjectInquiryForm } from "@/components/site/ProjectInquiryForm";
import { PortfolioStrip } from "@/components/site/PortfolioStrip";
import { getCaseStudy } from "@/data/work";
import "./industry.css";

const num = (i: number) => String(i + 1).padStart(2, "0");

/* --------------------------------------------------------------- helpers */

/** Roving-focus tab group: hover / focus / click / arrow keys all select. */
function useTabs(count: number) {
  const [active, setActive] = useState(0);
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? count - 1 : (index + step + count) % count;
    setActive(next);
    const group = e.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return { active, setActive, onKeyDown };
}

/* ------------------------------------------------------------------ page */

export function IndustryPage({
  industry,
  beforeCta,
  hiddenSections = [],
}: {
  industry: Industry;
  /** Optional extra content rendered just before the closing enquiry section. */
  beforeCta?: ReactNode;
  hiddenSections?: Array<"howWeHelp" | "growthSystem" | "process">;
}) {
  const caps = capabilitiesFor(industry.recommendedCapabilities);
  const hidden = (s: "howWeHelp" | "growthSystem" | "process") => hiddenSections.includes(s);

  return (
    <div className="ind">
      <Hero industry={industry} caps={caps} />
      <Outcome industry={industry} />
      <PainPoints industry={industry} />
      {!hidden("howWeHelp") ? <HowWeHelp industry={industry} caps={caps} /> : null}
      {!hidden("growthSystem") ? <GrowthSystem industry={industry} /> : null}
      <Proof industry={industry} />
      {!hidden("process") ? <Process /> : null}
      <WhyHQ360 />
      <Faq industry={industry} />
      {beforeCta}
      <StartCta industry={industry} />
    </div>
  );
}

/* -------------------------------------------------------------- 1 · hero */

function Hero({
  industry,
  caps,
}: {
  industry: Industry;
  caps: ReturnType<typeof capabilitiesFor>;
}) {
  const orbit = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const nodes = caps.slice(0, 4);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function move(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const b = el.getBoundingClientRect();
      orbit.current?.style.setProperty("--px", `${((clientX - b.left) / b.width - 0.5) * 12}px`);
      orbit.current?.style.setProperty("--py", `${((clientY - b.top) / b.height - 0.5) * 12}px`);
    });
  }
  function reset() {
    cancelAnimationFrame(frame.current);
    orbit.current?.style.setProperty("--px", "0px");
    orbit.current?.style.setProperty("--py", "0px");
  }

  return (
    <section className="ind-hero hqd-hero-section">
      <span className="hqd-hero-glow" aria-hidden="true" />
      <span className="hqd-hero-shade" aria-hidden="true" />
      <div className="ind-hero-grid" aria-hidden="true" />
      <Container size="wide" className="relative z-10">
        <nav aria-label="Breadcrumb" className="ind-crumb">
          <Link to="/industries">Industries</Link>
          <span aria-hidden="true">/</span>
          <span>{industry.shortName}</span>
        </nav>
        <div className="ind-hero-layout">
          <div className="ind-hero-copy">
            <p className="ind-eyebrow">
              <span /> {industry.eyebrow}
            </p>
            <h1>{industry.headline}</h1>
            <p className="ind-hero-lede">{industry.subheadline}</p>
            <div className="ind-actions">
              <a href="#start" className="ind-btn ind-btn-primary">
                {industry.cta.label} <ArrowUpRight aria-hidden="true" />
              </a>
              <Link to="/work" className="ind-btn ind-btn-ghost">
                See the work <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="ind-orbit-wrap" onPointerMove={move} onPointerLeave={reset}>
            <div
              ref={orbit}
              className="ind-orbit"
              role="img"
              aria-label={`${industry.shortName} growth system`}
            >
              <div className="ind-orbit-ring r-a" />
              <div className="ind-orbit-ring r-b" />
              <div className="ind-orbit-ring r-c" />
              <div className="ind-orbit-core">
                <Sparkles aria-hidden="true" />
                <strong>{industry.shortName}</strong>
                <span>connected growth</span>
              </div>
              {nodes.map((c, i) => (
                <Link key={c.slug} to={c.path} className={`ind-orbit-node n-${i + 1}`}>
                  <span>{num(i)}</span>
                  {c.label}
                </Link>
              ))}
              <span className="ind-orbit-spark" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------- 2 · outcome */

function Outcome({ industry }: { industry: Industry }) {
  return (
    <section className="ind-outcome">
      <Container size="wide">
        <div className="ind-outcome-layout">
          <div className="ind-outcome-lead">
            <p className="ind-eyebrow">
              <span /> The outcome
            </p>
            <p className="ind-outcome-line">{industry.outcome}</p>
          </div>
          <ol className="ind-outcome-list">
            {industry.outcomes.map((o, i) => (
              <li key={o} style={{ "--d": `${i * 60}ms` } as Record<string, string>}>
                <span>{num(i)}</span>
                {o}
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------- 3 · pain points */

function PainPoints({ industry }: { industry: Industry }) {
  const { active, setActive, onKeyDown } = useTabs(industry.painPoints.length);
  const point = industry.painPoints[active]!;
  return (
    <section className="ind-pain">
      <Container size="wide">
        <div className="ind-section-head">
          <p className="ind-eyebrow">
            <span /> Sound familiar?
          </p>
          <h2>Where {industry.shortName.toLowerCase()} growth usually stalls</h2>
        </div>
        <div className="ind-pain-layout">
          <div className="ind-pain-tabs" role="tablist" aria-label="Common blockers">
            {industry.painPoints.map((p, i) => (
              <button
                key={p.title}
                type="button"
                role="tab"
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                className={i === active ? "active" : ""}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <span>{num(i)}</span>
                {p.title}
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="ind-pain-panel" role="tabpanel" aria-live="polite">
            <span className="ind-pain-ghost" aria-hidden="true">
              {num(active)}
            </span>
            <h3>{point.title}</h3>
            <p>{point.body}</p>
            <div className="ind-pain-flags">
              <p>Usually holding it back</p>
              <ul>
                {industry.holdingBack.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- 4 · how we help */

function HowWeHelp({
  industry,
  caps,
}: {
  industry: Industry;
  caps: ReturnType<typeof capabilitiesFor>;
}) {
  return (
    <section className="ind-help">
      <Container size="wide">
        <div className="ind-section-head light">
          <p className="ind-eyebrow">
            <span /> How HQ360 helps
          </p>
          <h2>One connected system, not another vendor to manage</h2>
        </div>
        <ol className="ind-help-steps">
          {industry.howWeHelp.map((p, i) => (
            <li key={i}>
              <span>{num(i)}</span>
              <p>{p}</p>
            </li>
          ))}
        </ol>
        <div className="ind-help-caps">
          <span>Capabilities in play</span>
          {caps.map((c) => (
            <Link key={c.slug} to={c.path} className="ind-chip">
              {c.label}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------- 5 · growth system */

function GrowthSystem({ industry }: { industry: Industry }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-35% 0px -50% 0px" },
    );
    list.querySelectorAll("li").forEach((li) => obs.observe(li));
    return () => obs.disconnect();
  }, []);
  const steps = industry.growthSystem;
  return (
    <section className="ind-system">
      <Container size="wide">
        <div className="ind-section-head">
          <p className="ind-eyebrow">
            <span /> Example growth system
          </p>
          <h2>What a {industry.shortName} engagement can look like</h2>
          <p>A representative build. The exact scope is set once we see what you already run.</p>
        </div>
        <div className="ind-system-layout">
          <ol
            ref={listRef}
            className="ind-system-steps"
            style={
              { "--progress": `${((active + 1) / steps.length) * 100}%` } as Record<string, string>
            }
          >
            {steps.map((s, i) => (
              <li key={s.title} data-i={i} className={i === active ? "active" : ""}>
                <span className="ind-system-step">{s.step}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="ind-system-services">
            <p>Services often included</p>
            <ul>
              {industry.services.map((s) => (
                <li key={s}>
                  <Check aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------- 6 · proof + portfolio */

function Proof({ industry }: { industry: Industry }) {
  return (
    <>
      {industry.proof && industry.proof.length > 0 ? (
        <section className="ind-proof">
          <Container size="wide">
            <div className="ind-section-head">
              <p className="ind-eyebrow">
                <span /> Proof
              </p>
              <h2>Related work</h2>
            </div>
            <ul className="ind-proof-list">
              {industry.proof.map((p, i) => {
                const study = p.slug ? getCaseStudy(p.slug) : undefined;
                return (
                  <li key={i}>
                    <p>{p.text}</p>
                    {study ? (
                      <Link
                        to="/work/$slug"
                        params={{ slug: study.slug }}
                        className="ind-text-link"
                      >
                        View the project <ArrowUpRight aria-hidden="true" />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Container>
        </section>
      ) : null}
      <div className="ind-portfolio">
        <PortfolioStrip industry={industry.slug} eyebrow="Selected work" title="Recent work" />
      </div>
    </>
  );
}

/* ---------------------------------------------------------- 7 · process */

function Process() {
  const steps = [
    ["Discover", "We map where you are, where you want to go, and what has already been tried."],
    ["Diagnose", "We find the one constraint holding growth back before recommending anything."],
    ["Strategise", "You get a practical plan — scope, owners, milestones, measures."],
    ["Build", "Creative, site and automation take shape together, with visible review points."],
    ["Launch", "We connect the pieces, check the journey end to end, and go live."],
    ["Optimise", "We read the signals, fix the weak points, and build on what works."],
  ];
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-40% 0px -45% 0px" },
    );
    list.querySelectorAll("li").forEach((li) => obs.observe(li));
    return () => obs.disconnect();
  }, []);
  return (
    <section className="ind-process">
      <Container size="wide">
        <div className="ind-process-layout">
          <div className="ind-process-head">
            <p className="ind-eyebrow">
              <span /> How we run it
            </p>
            <h2>The same six steps, every engagement</h2>
            <div className="ind-process-counter" aria-hidden="true">
              <strong>{num(active)}</strong>
              <span>/ 06 · {steps[active]![0]}</span>
            </div>
          </div>
          <ol
            ref={listRef}
            className="ind-process-list"
            style={
              { "--progress": `${((active + 1) / steps.length) * 100}%` } as Record<string, string>
            }
          >
            {steps.map(([title, body], i) => (
              <li key={title} data-i={i} className={i === active ? "active" : ""}>
                <span>{num(i)}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------- 8 · why hq360 */

function WhyHQ360() {
  return (
    <section className="ind-why">
      <Container size="wide">
        <div className="ind-section-head light">
          <p className="ind-eyebrow">
            <span /> Why HQ360
          </p>
          <h2>What working with us actually means</h2>
        </div>
        <ol className="ind-why-list">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title}>
              <span>{num(i)}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- 9 · faq */

function Faq({ industry }: { industry: Industry }) {
  return (
    <section className="ind-faq">
      <Container size="wide">
        <div className="ind-faq-layout">
          <div className="ind-section-head">
            <p className="ind-eyebrow">
              <span /> Questions
            </p>
            <h2>{industry.shortName}, answered</h2>
          </div>
          <FaqSection faqs={industry.faqs} idPrefix={`ind-${industry.slug}`} />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- 10 · start */

function StartCta({ industry }: { industry: Industry }) {
  return (
    <section id="start" className="ind-start">
      <div className="ind-start-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Container size="wide" className="relative z-10">
        <div className="ind-start-layout">
          <div>
            <p className="ind-eyebrow">
              <span /> Start here
            </p>
            <h2>{industry.cta.label}</h2>
            <p className="ind-start-sub">
              {industry.cta.sub} No obligation — a straight read on what we would do and whether we
              are the right fit.
            </p>
            <ul className="ind-start-points">
              <li>We reply within one working day</li>
              <li>You own every account and asset we build</li>
              <li>Month-to-month on ongoing work, 30 days&rsquo; notice</li>
            </ul>
          </div>
          <ProjectInquiryForm
            defaultIndustry={industry.shortName}
            sourceIndustry={industry.shortName}
          />
        </div>
      </Container>
    </section>
  );
}
