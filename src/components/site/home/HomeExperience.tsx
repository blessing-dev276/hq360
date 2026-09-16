import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Sparkles } from "lucide-react";
import { CAPABILITIES } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";
import { GROWTH_FRAMEWORK, PROCESS } from "@/data/process";
import { CASE_STUDIES } from "@/data/work";
import { CTAS } from "@/config/brand";
import { Container } from "@/components/site/Primitives";
import { Reveal } from "@/components/site/Reveal";
import { TeamShowcase } from "@/components/site/TeamShowcase";
import { ProofSkeleton } from "./HomeSkeletons";
import "./home.css";

const LazyProofStrip = lazy(() =>
  import("@/components/site/ProofStrip").then((m) => ({ default: m.ProofStrip })),
);
const PRIMARY_CAPABILITIES = CAPABILITIES.slice(0, 6);
const FEATURED_SLUGS = [
  "authors",
  "creators",
  "real-estate",
  "coaches",
  "ecommerce",
  "home-services",
  "agencies",
];
const FEATURED_INDUSTRIES = FEATURED_SLUGS.map((slug) =>
  INDUSTRIES.find((item) => item.slug === slug),
).filter((item): item is (typeof INDUSTRIES)[number] => Boolean(item));

function SmartLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} preload="intent" className={className}>
      {children}
    </Link>
  );
}

/** The first phrase is server-rendered; motion starts only after hydration. */
const HERO_LEAD = "Everything your brand needs ";
const HERO_PHRASES = ["to grow.", "to convert.", "to get found.", "to scale.", "to win."];
const HERO_LONGEST_PHRASE = HERO_PHRASES.reduce((longest, phrase) =>
  phrase.length > longest.length ? phrase : longest,
);

// Per-character while typing / deleting; once-per-phase for the pauses.
const TYPE_MS = 500;
const DELETE_MS = 240;
const HOLD_MS = 3200;
const NEXT_MS = 700;

type TypeMode = "typing" | "holding" | "deleting" | "waiting";

function HeroTypewriter() {
  const [ready, setReady] = useState(false);
  const [{ phrase, len, mode }, setFrame] = useState({
    phrase: 0,
    len: HERO_PHRASES[0]!.length,
    mode: "holding" as TypeMode,
  });

  // Start after hydration so SSR and the first client render match.
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    const delay = { typing: TYPE_MS, holding: HOLD_MS, deleting: DELETE_MS, waiting: NEXT_MS }[
      mode
    ];
    const timer = window.setTimeout(() => {
      setFrame((frame) => {
        const current = HERO_PHRASES[frame.phrase]!;
        switch (frame.mode) {
          case "holding":
            return { ...frame, mode: "deleting" };
          case "deleting": {
            const nextLen = Math.max(0, frame.len - 1);
            return { ...frame, len: nextLen, mode: nextLen === 0 ? "waiting" : "deleting" };
          }
          case "waiting":
            return { phrase: (frame.phrase + 1) % HERO_PHRASES.length, len: 0, mode: "typing" };
          case "typing": {
            const nextLen = Math.min(current.length, frame.len + 1);
            return {
              ...frame,
              len: nextLen,
              mode: nextLen === current.length ? "holding" : "typing",
            };
          }
        }
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [ready, mode, len, phrase]);

  const text = ready ? HERO_PHRASES[phrase]!.slice(0, len) : HERO_PHRASES[0]!;

  return (
    <span className="home-hero-type" aria-hidden="true">
      {HERO_LEAD}
      <span className="home-hero-accent">
        <span className="home-hero-phrase-size">{HERO_LONGEST_PHRASE}</span>
        <span className="home-hero-phrase">
          <em>{text}</em>
          <span
            className="home-hero-caret"
            data-mode={ready ? mode : "static"}
            aria-hidden="true"
          />
        </span>
      </span>
    </span>
  );
}

export function HomeExperience() {
  return (
    <div className="home-experience">
      <Hero />
      <TrustStrip />
      <GrowthSystem />
      <CapabilitiesExplorer />
      <IndustriesExplorer />
      <ConnectedSystem />
      <WhyHQ360 />
      <ProcessStory />
      <ProofExperience />
      <TeamSection />
      <ClosingCta />
    </div>
  );
}

function Hero() {
  const visualRef = useRef<HTMLDivElement>(null);
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    visualRef.current?.style.setProperty(
      "--orbit-x",
      `${((event.clientX - bounds.left) / bounds.width - 0.5) * 10}px`,
    );
    visualRef.current?.style.setProperty(
      "--orbit-y",
      `${((event.clientY - bounds.top) / bounds.height - 0.5) * 10}px`,
    );
  }
  function resetPointer() {
    visualRef.current?.style.setProperty("--orbit-x", "0px");
    visualRef.current?.style.setProperty("--orbit-y", "0px");
  }
  return (
    <section className="home-hero" data-ambient>
      <span className="home-hero-aurora" aria-hidden="true" />
      <div className="home-hero-grid" aria-hidden="true" />
      <Container size="wide" className="relative z-10">
        <div className="home-hero-layout">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              <span /> Strategy · Creative · Technology · Growth
            </p>
            <h1 aria-label={HERO_LEAD + HERO_PHRASES[0]}>
              <HeroTypewriter />
            </h1>
            <p className="home-hero-lede">
              HQ360 is a growth agency for businesses and personal brands. We connect brand,
              websites, automation, marketing, content and search visibility in one plan.
            </p>
            <div className="home-actions">
              <SmartLink to={CTAS.primary.to} className="home-button home-button-primary">
                Start a project <ArrowUpRight aria-hidden="true" />
              </SmartLink>
              <SmartLink to="/industries" className="home-button home-button-ghost">
                Explore industries <ArrowRight aria-hidden="true" />
              </SmartLink>
            </div>
            <div className="home-hero-context">
              <span>Worldwide service</span>
              <span>USA-focused</span>
              <span>Multi-industry</span>
            </div>
          </div>
          <div
            className="home-orbit-wrap"
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
          >
            <div
              ref={visualRef}
              className="home-orbit"
              role="img"
              aria-label="HQ360 connected growth orbit"
            >
              <div className="home-orbit-ring ring-a" />
              <div className="home-orbit-ring ring-b" />
              <div className="home-orbit-ring ring-c" />
              <div className="home-orbit-core">
                <Sparkles aria-hidden="true" />
                <strong>HQ360</strong>
                <span>One growth system</span>
              </div>
              {PRIMARY_CAPABILITIES.map((capability, index) => (
                <SmartLink
                  key={capability.slug}
                  to={capability.path}
                  className={`home-orbit-node node-${index + 1}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {capability.label}
                </SmartLink>
              ))}
              <span className="home-orbit-spark" aria-hidden="true" />
            </div>
          </div>
        </div>
        <a className="home-scroll-cue" href="#growth-system">
          <ArrowDown aria-hidden="true" /> Discover the system
        </a>
      </Container>
    </section>
  );
}

function TrustStrip() {
  const points = [
    "Strategy to execution",
    "Connected growth systems",
    "Built around business outcomes",
    "Multi-industry experience",
    "Worldwide delivery",
  ];
  return (
    <section className="home-trust" aria-label="How HQ360 works">
      <div className="home-trust-track">
        {[...points, ...points].map((point, index) => (
          <span key={`${point}-${index}`}>
            <i aria-hidden="true" /> {point}
          </span>
        ))}
      </div>
    </section>
  );
}

function GrowthSystem() {
  const [active, setActive] = useState(0);
  const stage = GROWTH_FRAMEWORK[active]!;
  return (
    <section id="growth-system" className="home-growth-section">
      <Container size="wide">
        <Reveal>
          <div className="home-section-intro light">
            <p className="home-eyebrow">
              <span /> The HQ360 growth loop
            </p>
            <h2>Six stages. One continuous advantage.</h2>
            <p>Every stage strengthens the next. Select a point in the loop to see its role.</p>
          </div>
        </Reveal>
        <div className="home-growth-layout">
          <div className="home-growth-wheel" aria-label="Six stages of the HQ360 growth system">
            <div className="home-growth-wheel-ring" aria-hidden="true" />
            <div className="home-growth-center">
              <span>{String(active + 1).padStart(2, "0")}</span>
              <strong>{stage.title}</strong>
            </div>
            {GROWTH_FRAMEWORK.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`home-growth-stage stage-${index + 1} ${index === active ? "active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                aria-pressed={index === active}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.title}
              </button>
            ))}
          </div>
          <div className="home-growth-detail" aria-live="polite">
            <span className="home-detail-number">0{active + 1}</span>
            <p className="home-detail-label">Current stage</p>
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
            <div className="home-growth-progress">
              <span style={{ width: `${((active + 1) / 6) * 100}%` }} />
            </div>
            <div className="home-mobile-stage-list">
              {GROWTH_FRAMEWORK.map((item, index) => (
                <button
                  key={item.key}
                  onClick={() => setActive(index)}
                  aria-pressed={index === active}
                >
                  {String(index + 1).padStart(2, "0")} {item.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function CapabilitiesExplorer() {
  const [active, setActive] = useState(0);
  const capability = PRIMARY_CAPABILITIES[active]!;
  return (
    <section className="home-capabilities">
      <Container size="wide">
        <div className="home-capabilities-layout">
          <div className="home-capability-display" aria-live="polite">
            <p className="home-eyebrow">
              <span /> What we do
            </p>
            <span className="home-capability-index">0{active + 1} / 06</span>
            <h2>{capability.name}</h2>
            <p className="home-capability-tagline">{capability.tagline}</p>
            <p className="home-capability-summary">{capability.summary}</p>
            <ul>
              {capability.services.slice(0, 3).map((service) => (
                <li key={service.title}>
                  <Check aria-hidden="true" /> {service.title}
                </li>
              ))}
            </ul>
            <SmartLink to={capability.path} className="home-text-link">
              Explore this capability <ArrowRight aria-hidden="true" />
            </SmartLink>
          </div>
          <div className="home-capability-list" role="group" aria-label="HQ360 capabilities">
            {PRIMARY_CAPABILITIES.map((item, index) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={index === active}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                className={index === active ? "active" : ""}
              >
                <span>0{index + 1}</span>
                <strong>{item.label}</strong>
                <ArrowUpRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function IndustriesExplorer() {
  const [active, setActive] = useState(0);
  const industry = FEATURED_INDUSTRIES[active]!;
  return (
    <section className="home-industries">
      <Container size="wide">
        <Reveal>
          <div className="home-section-intro">
            <p className="home-eyebrow">
              <span /> Who we help
            </p>
            <h2>Built for the way your market wins.</h2>
            <p>Different industries need different paths to attention, trust and conversion.</p>
          </div>
        </Reveal>
        <div className="home-industry-layout">
          <div className="home-industry-list" role="group" aria-label="Featured industries">
            {FEATURED_INDUSTRIES.map((item, index) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={index === active}
                className={index === active ? "active" : ""}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
              >
                <span>{item.shortName}</span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
            <SmartLink to="/industries" className="home-industry-all">
              View all {INDUSTRIES.length} industries <ArrowUpRight aria-hidden="true" />
            </SmartLink>
          </div>
          <div className="home-industry-preview" aria-live="polite">
            <div className="home-industry-orbit" aria-hidden="true">
              <span />
              <i />
            </div>
            <p className="home-detail-label">{industry.category}</p>
            <h3>{industry.shortName}</h3>
            <p className="home-industry-outcome">{industry.outcome}</p>
            <p>{industry.description}</p>
            <SmartLink to={industry.path} className="home-button home-button-light">
              View {industry.shortName} services <ArrowRight aria-hidden="true" />
            </SmartLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

const SYSTEM_STEPS = [
  ["Traffic", "SEO · Social · Ads"],
  ["Experience", "Website · Landing page · Portfolio"],
  ["Capture", "Forms · Lead magnets · CRM"],
  ["Follow-up", "Email · SMS · Automation"],
  ["Conversion", "Booking · Purchase · Inquiry"],
  ["Retention", "Reviews · Nurture · Repeat business"],
];
function ConnectedSystem() {
  return (
    <section className="home-connected">
      <Container size="wide">
        <div className="home-connected-heading">
          <p className="home-eyebrow">
            <span /> How it connects
          </p>
          <h2>Attention is useful only when the rest of the journey works.</h2>
          <p>
            We design every handoff—from first impression to repeat customer—as one measurable path.
          </p>
        </div>
        <ol className="home-system-flow">
          {SYSTEM_STEPS.map(([title, detail], index) => (
            <li key={title}>
              <span className="home-system-number">0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              {index < SYSTEM_STEPS.length - 1 ? <ArrowRight aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const DIFFERENTIATORS = [
  [
    "01",
    "One accountable team",
    "Strategy, creative, technology and performance move from the same plan.",
  ],
  [
    "02",
    "Built around your market",
    "The system adapts to how your buyers discover, decide and return.",
  ],
  [
    "03",
    "Strategy before production",
    "We diagnose the constraint before recommending the deliverable.",
  ],
  ["04", "Designed for action", "Every touchpoint has a job, a next step and a way to measure it."],
];
function WhyHQ360() {
  return (
    <section className="home-why">
      <Container size="wide">
        <div className="home-why-layout">
          <div className="home-why-title">
            <p className="home-eyebrow">
              <span /> Why HQ360
            </p>
            <h2>Good-looking work is the starting point.</h2>
          </div>
          <ol>
            {DIFFERENTIATORS.map(([number, title, body]) => (
              <li key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

function ProcessStory() {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-30% 0px -45% 0px" },
    );
    list.querySelectorAll("li").forEach((li) => observer.observe(li));
    return () => observer.disconnect();
  }, []);
  return (
    <section className="home-process">
      <Container size="wide">
        <div className="home-process-layout">
          <div className="home-process-heading">
            <p className="home-eyebrow">
              <span /> How we work
            </p>
            <h2>Clarity at every stage.</h2>
            <p>A visible process keeps the work moving and every decision grounded.</p>
            <div className="home-process-counter" aria-hidden="true">
              <strong>{PROCESS[active]?.step}</strong>
              <span>
                / {String(PROCESS.length).padStart(2, "0")} · {PROCESS[active]?.title}
              </span>
            </div>
          </div>
          <ol
            ref={listRef}
            className="home-process-list"
            style={
              { "--process-progress": `${((active + 1) / PROCESS.length) * 100}%` } as CSSProperties
            }
          >
            {PROCESS.map((item, index) => (
              <li key={item.step} data-step={index} className={index === active ? "active" : ""}>
                <span>{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

function ProofExperience() {
  const [near, setNear] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const verified = CASE_STUDIES.find((study) => study.status === "verified");
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  return (
    <section ref={sectionRef} className="home-proof">
      <Container size="wide">
        <div className="home-proof-heading">
          <div>
            <p className="home-eyebrow">
              <span /> Verified proof
            </p>
            <h2>Real work. Real clients. No invented numbers.</h2>
          </div>
          {verified ? (
            <SmartLink to={`/work/${verified.slug}`} className="home-text-link">
              View featured project <ArrowUpRight aria-hidden="true" />
            </SmartLink>
          ) : null}
        </div>
        {near ? (
          <Suspense fallback={<ProofSkeleton />}>
            <LazyProofStrip />
          </Suspense>
        ) : (
          <ProofSkeleton />
        )}
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- team */

function TeamSection() {
  return (
    <section className="home-team-section" data-ambient>
      <Container size="wide">
        <TeamShowcase
          title={
            <>
              Meet the team. <em>Tap a card to see what they own.</em>
            </>
          }
          limit={4}
          viewAll={{ label: "View the whole team", to: "/team" }}
        />
      </Container>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="home-closing">
      <div className="home-closing-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Container size="wide" className="relative z-10">
        <p className="home-eyebrow">
          <span /> Your next move
        </p>
        <h2>Your growth shouldn’t depend on five different agencies.</h2>
        <p>Bring strategy, creative, technology and performance under one accountable system.</p>
        <div className="home-actions">
          <SmartLink to={CTAS.primary.to} className="home-button home-button-orange">
            Start a project <ArrowUpRight aria-hidden="true" />
          </SmartLink>
          <SmartLink to="/industries" className="home-button home-button-dark-ghost">
            Explore industries <ArrowRight aria-hidden="true" />
          </SmartLink>
        </div>
      </Container>
    </section>
  );
}
