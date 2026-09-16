import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { PHOTOS as TEAM_PHOTOS } from "@/components/site/TeamAvatar";
import { GROWTH_FRAMEWORK, PRINCIPLES, PROCESS } from "@/data/process";
import { TEAM } from "@/data/team";
import { BRAND, CTAS } from "@/config/brand";
import "./about.css";

const num = (i: number) => String(i + 1).padStart(2, "0");
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/** Scroll-linked active index for a vertical stepper. */
function useScrollStepper(count: number) {
  const ref = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const list = ref.current;
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
  }, [count]);
  return { ref, active, progress: ((active + 1) / count) * 100 };
}

export function AboutExperience() {
  return (
    <div className="ab">
      <Hero />
      <Founder />
      <Seams />
      <Framework />
      <Principles />
      <TeamTeaser />
      <Process />
      <History />
      <Reach />
      <CtaBand
        title="See what we would build for you"
        body="Start a project and we will map a first phase for your specific situation."
        primary={CTAS.primary}
        secondary={CTAS.work}
      />
    </div>
  );
}

/* --------------------------------------------------------- 1 · hero */

const HERO_NODES = ["Brand", "Website", "Advertising", "CRM", "Content"];
const HERO_CAPTION = {
  split: "Five vendors. Five dashboards. Nobody accountable for the result.",
  one: "One plan. One set of shared metrics. One team from spend to signed customer.",
} as const;

function Hero() {
  const [mode, setMode] = useState<"split" | "one">("split");

  // A single, gentle auto-transition on load tells the story without a click.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setMode("one");
      return;
    }
    const t = setTimeout(() => setMode("one"), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="ab-hero">
      <div className="ab-hero-grid" aria-hidden="true" />
      <Container size="wide" className="relative z-10">
        <div className="ab-hero-centered">
          <div className="ab-hero-copy">
            <p className="ab-eyebrow">
              <span /> About {BRAND.name}
            </p>
            <h1>Growth that connects, from one team</h1>
            <p className="ab-hero-lede">
              Most businesses are told to fix growth by hiring more specialists — and end up with
              five vendors, five dashboards and nobody accountable for the result. We built{" "}
              {BRAND.name} to close those seams.
            </p>

            <div
              className="ab-toggle"
              role="group"
              aria-label="Compare a fragmented setup with one connected team"
            >
              <button
                type="button"
                aria-pressed={mode === "split"}
                onClick={() => setMode("split")}
              >
                Five vendors
              </button>
              <button type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")}>
                One team
              </button>
            </div>

            <p className="ab-hero-caption" aria-live="polite">
              {HERO_CAPTION[mode]}
            </p>
          </div>

          <div className="ab-cons-wrap">
            <div
              className={`ab-cons ${mode === "one" ? "is-one" : "is-split"}`}
              role="img"
              aria-label={
                mode === "one"
                  ? "Brand, website, advertising, CRM and content connected in one ring around HQ360"
                  : "Brand, website, advertising, CRM and content scattered as separate vendors"
              }
            >
              <div className="ab-cons-ring" aria-hidden="true" />
              <div className="ab-cons-core">
                <strong>{BRAND.name}</strong>
                <span>one system</span>
              </div>
              {HERO_NODES.map((label, i) => (
                <span key={label} className={`ab-node n-${i + 1}`} aria-hidden="true">
                  {label}
                  <small>{mode === "one" ? "shared metric" : `dashboard ${num(i)}`}</small>
                </span>
              ))}
              <span className="ab-cons-spark" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- 1b · founder */

const FOUNDER = TEAM[0]!;

function Founder() {
  const photo = TEAM_PHOTOS[FOUNDER.photo];
  return (
    <section className="ab-founder">
      <Container size="wide">
        <div className="ab-founder-card">
          <div className="ab-founder-photo">
            {photo ? (
              <img src={photo} alt={`${FOUNDER.name}, Founder & CEO of ${BRAND.name}`} loading="lazy" decoding="async" />
            ) : (
              <span aria-hidden="true">{FOUNDER.initials}</span>
            )}
          </div>
          <p className="ab-eyebrow">
            <span /> From our founder
          </p>
          <p className="ab-founder-quote">
            &ldquo;{FOUNDER.blurb}&rdquo;
          </p>
          <p className="ab-founder-byline">
            <strong>{FOUNDER.name}</strong>
            <span>Founder &amp; CEO, {BRAND.name}</span>
          </p>
          <Link to="/team" className="ab-founder-link">
            Meet the rest of the team <ArrowRight aria-hidden="true" className="inline size-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------- 2 · seams */

const SEAMS = [
  {
    tab: "Leads with no home",
    title: "Leads arrive that the follow-up was never built for",
    body: "Advertising generates enquiries the CRM and the sales process were never designed to catch, so they cool off in an inbox while everyone waits on someone else.",
    symptom: "Cost per lead looks fine. Cost per customer never moves.",
  },
  {
    tab: "Redesigns break tracking",
    title: "A new site quietly kills the tracking the ads depend on",
    body: "The website team ships a redesign and the events the ad account optimised against stop firing. No handoff covered it, because it sat between two teams.",
    symptom: "Reporting goes dark for weeks before anyone notices.",
  },
  {
    tab: "Brand, wrong order",
    title: "The brand refresh lands after the campaign that needed it",
    body: "Identity work finishes months late, so the launch runs on the old look and the new one arrives once the moment has passed.",
    symptom: "Two versions of the brand live in market at once.",
  },
  {
    tab: "Five dashboards",
    title: "Every vendor reports on its own metric",
    body: "Impressions here, open rates there, sessions somewhere else — and none of them add up to a revenue number anyone can act on.",
    symptom: "The weekly call is spent reconciling numbers, not deciding.",
  },
  {
    tab: "Nobody owns it",
    title: "Everyone hits their target and pipeline stays flat",
    body: "Each specialist optimises for the metric they are measured on. The number that actually pays the bills belongs to no one.",
    symptom: "Great individual reports. Flat results.",
  },
] as const;

function Seams() {
  const { active, setActive, onKeyDown } = useTabs(SEAMS.length);
  const seam = SEAMS[active]!;
  return (
    <section className="ab-seams">
      <Container size="wide">
        <div className="ab-section-head">
          <p className="ab-eyebrow">
            <span /> Why fragmented systems fail
          </p>
          <h2>Everyone did their job. The system still leaks.</h2>
          <p>
            When brand, website, advertising, CRM and content are split across separate teams, each
            one optimises for its own metric. Here is where the seams open up.
          </p>
        </div>

        <div className="ab-seams-layout">
          <div className="ab-seams-tabs" role="tablist" aria-label="Common seams">
            {SEAMS.map((s, i) => (
              <button
                key={s.tab}
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
                {s.tab}
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="ab-seams-panel" role="tabpanel" aria-live="polite">
            <span className="ab-seams-ghost" aria-hidden="true">
              {num(active)}
            </span>
            <h3>{seam.title}</h3>
            <p>{seam.body}</p>
            <div className="ab-seams-symptom">
              <span>What you see</span>
              <p>{seam.symptom}</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------- 3 · framework */

function Framework() {
  const { active, setActive, onKeyDown } = useTabs(GROWTH_FRAMEWORK.length);
  const stage = GROWTH_FRAMEWORK[active]!;
  return (
    <section className="ab-dial">
      <Container size="wide">
        <div className="ab-section-head">
          <p className="ab-eyebrow">
            <span /> The approach
          </p>
          <h2>One system, six connected stages</h2>
          <p>
            The &ldquo;360&rdquo; — the loop a business runs as it grows. We work the whole circle,
            not a slice of it. Spin the dial.
          </p>
        </div>

        <div className="ab-dial-layout">
          <div
            className="ab-dial-stage"
            role="tablist"
            aria-label="The six stages of the HQ360 growth framework"
          >
            <div className="ab-dial-ring" aria-hidden="true" />
            <div
              className="ab-dial-needle"
              aria-hidden="true"
              style={{ "--angle": `${active * 60}deg` } as Record<string, string>}
            />
            <div className="ab-dial-core" aria-hidden="true">
              <b>{num(active)} / 06</b>
              <strong>{stage.title}</strong>
            </div>
            {GROWTH_FRAMEWORK.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                className={`ab-dial-node p-${i + 1} ${i === active ? "active" : ""}`}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <span>{num(i)}</span>
                {s.title}
              </button>
            ))}
          </div>

          <div className="ab-dial-detail" role="tabpanel" aria-live="polite">
            <p className="ab-eyebrow">
              <span /> Stage {num(active)}
            </p>
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
            <p className="ab-dial-progress">
              <b>{num(active)}</b> of 06 &middot; the loop keeps running
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------- 4 · principles */

function Principles() {
  return (
    <section className="ab-principles">
      <Container size="wide">
        <div className="ab-section-head light">
          <p className="ab-eyebrow">
            <span /> Principles
          </p>
          <h2>What we do not bend on</h2>
        </div>
        <ul className="ab-principles-list">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title} data-n={num(i)}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------- 5 · team */

function TeamTeaser() {
  return (
    <section className="ab-team-teaser">
      <Container size="wide">
        <div className="ab-team-teaser-inner">
          <div>
            <p className="ab-eyebrow">
              <span /> The team
            </p>
            <h2>A small multidisciplinary team, every discipline in-house</h2>
            <p>One named lead per engagement &mdash; no account managers relaying work between vendors.</p>
          </div>
          <Link to="/team" className="ab-btn ab-btn-primary">
            Meet the team <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------- 6 · process */

function Process() {
  const { ref, active, progress } = useScrollStepper(PROCESS.length);
  return (
    <section className="ab-process">
      <Container size="wide">
        <div className="ab-process-layout">
          <div className="ab-process-head">
            <p className="ab-eyebrow">
              <span /> How we run it
            </p>
            <h2>The same six steps, every engagement</h2>
            <div className="ab-process-counter" aria-hidden="true">
              <strong>{num(active)}</strong>
              <span>/ 06 &middot; {PROCESS[active]!.title}</span>
            </div>
          </div>
          <ol
            ref={ref}
            className="ab-process-list"
            style={{ "--progress": `${progress}%` } as Record<string, string>}
          >
            {PROCESS.map((s, i) => (
              <li key={s.step} data-i={i} className={i === active ? "active" : ""}>
                <span>{s.step}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------- 7 · history */

const HISTORY = [
  {
    label: "01",
    name: "House of Synergy",
    body: "We started as a book-marketing studio, building launches for authors and personal brands.",
  },
  {
    label: "02",
    name: "The same gap, everywhere",
    body: "The problems were never really about publishing. Split vendors and leaking hand-offs showed up in every market we looked at.",
  },
  {
    label: "03",
    name: `${BRAND.name}`,
    body: `We rebuilt the studio as a multi-industry growth agency — one team accountable for the whole path from spend to signed customer. The old practice became our Authors & Publishers vertical.`,
  },
  {
    label: "04",
    name: "Today",
    body: "The same system runs across real estate, home services, coaching, professional services, creators and local business — remote, and scheduled to your working hours.",
  },
] as const;

function History() {
  const { active, setActive, onKeyDown } = useTabs(HISTORY.length);
  const step = HISTORY[active]!;
  const progress = (active / (HISTORY.length - 1)) * 100;
  return (
    <section className="ab-history">
      <Container size="wide">
        <div className="ab-section-head">
          <p className="ab-eyebrow">
            <span /> Where we came from
          </p>
          <h2>
            {BRAND.name} grew out of {BRAND.formerlyKnownAs}
          </h2>
        </div>

        <div
          className="ab-history-track"
          role="tablist"
          aria-label="Company history"
          style={{ "--progress": `${progress}%` } as Record<string, string>}
        >
          {HISTORY.map((h, i) => (
            <button
              key={h.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              className={`ab-history-step ${i === active ? "active" : ""}`}
              onKeyDown={(e) => onKeyDown(e, i)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <span className="ab-dot" aria-hidden="true" />
              <b>{h.label}</b>
              <span>{h.name}</span>
            </button>
          ))}
        </div>

        <div className="ab-history-panel" role="tabpanel" aria-live="polite">
          <h3>{step.name}</h3>
          <p>{step.body}</p>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- 8 · reach */

function Reach() {
  return (
    <section className="ab-reach">
      <div className="ab-reach-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Container size="wide">
        <div className="ab-reach-layout">
          <p className="ab-eyebrow">
            <span /> Where we work
          </p>
          <h2>Worldwide, US-friendly</h2>
          <p>
            The team works remotely across time zones. A large share of our clients are in the
            United States, and calls are scheduled to your working hours. We do not operate physical
            offices, and we will never claim one we do not have.
          </p>
          <ul className="ab-reach-stats">
            <li>Remote-first</li>
            <li>US working hours</li>
            <li>You own every account and asset</li>
            <li>One point of contact</li>
          </ul>
          <p style={{ marginTop: "2rem" }}>
            <Link to="/contact" className="ab-btn ab-btn-primary">
              Start a project <ArrowUpRight aria-hidden="true" />
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
