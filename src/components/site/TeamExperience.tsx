import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Shuffle } from "lucide-react";
import { Container } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { PHOTOS as TEAM_PHOTOS } from "@/components/site/TeamAvatar";
import { TeamShowcase, type Person } from "@/components/site/TeamShowcase";
import { TEAM } from "@/data/team";
import { BRAND, CTAS } from "@/config/brand";
import "./about.css";
import "./team.css";

/** Department, derived from the person's existing role title — not a separate
 * fact to keep in sync. Used for the roster filter chips. */
function classifyDepartment(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("ceo") || r.includes("founder")) return "Leadership";
  if (r.includes("market") || r.includes("social")) return "Marketing";
  if (r.includes("brand") || r.includes("creative") || r.includes("video") || r.includes("design"))
    return "Creative";
  if (r.includes("web") || r.includes("app") || r.includes("dev") || r.includes("engineer"))
    return "Product";
  return "Team";
}

const DEPARTMENTS = ["All", ...new Set(TEAM.map((m) => classifyDepartment(m.role)))];

export function TeamExperience() {
  return (
    <div className="ab tm">
      <TeamHero />
      <TeamStats />
      <TeamValues />
      <Team />
      <TeamMatcher />
      <CtaBand
        title="See what we would build for you"
        body="Start a project and we will map a first phase for your specific situation."
        primary={CTAS.primary}
        secondary={CTAS.work}
      />
    </div>
  );
}

function TeamHero() {
  return (
    <section className="ab-hero ab-team-hero">
      <div className="ab-hero-grid" aria-hidden="true" />
      <Container size="wide" className="relative z-10">
        <div className="tm-hero-copy">
          <p className="ab-eyebrow">
            <span /> Meet the team
          </p>
          <h1>The people on your account</h1>
          <p className="ab-hero-lede">
            A small multidisciplinary team &mdash; every discipline in-house, one named lead per
            engagement. No account managers relaying work between vendors.
          </p>
          <div className="tm-hero-actions">
            <a href="#team" className="ab-btn ab-btn-primary">
              Meet the roster <ArrowRight aria-hidden="true" />
            </a>
            <Link to={CTAS.primary.to} className="ab-btn ab-btn-ghost">
              {CTAS.primary.label} <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <ul className="tm-hero-avatars" aria-hidden="true">
            {TEAM.map((member) => (
              <li key={member.name}>
                {TEAM_PHOTOS[member.photo] ? (
                  <img src={TEAM_PHOTOS[member.photo]} alt="" loading="eager" decoding="async" />
                ) : (
                  <span>{member.initials}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

const STATS = [
  { value: String(TEAM.length), label: "People, one team", detail: "Every discipline in-house." },
  { value: "1", label: "Lead per engagement", detail: "One named owner for your account." },
  { value: "0", label: "Account managers", detail: "You talk to the person doing the work." },
] as const;

function TeamStats() {
  return (
    <section className="tm-stats">
      <Container size="wide">
        <ul className="tm-stats-list">
          {STATS.map((stat) => (
            <li key={stat.label}>
              <strong>{stat.value}</strong>
              <span className="tm-stats-label">{stat.label}</span>
              <span className="tm-stats-detail">{stat.detail}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

const VALUES = [
  {
    title: "In-house, not outsourced",
    body: "Every discipline sits on the same team, so nothing gets lost in a handoff between vendors.",
  },
  {
    title: "One named lead",
    body: "Someone specific owns your account from kickoff to delivery, not a rotating support queue.",
  },
  {
    title: "Direct access",
    body: "You talk to the person doing the work, not an account manager relaying messages back and forth.",
  },
  {
    title: "Remote, on your schedule",
    body: "The team works across time zones and books calls to fit your working hours, not ours.",
  },
] as const;

function TeamValues() {
  return (
    <section className="tm-values">
      <Container size="wide">
        <div className="ab-section-head light">
          <p className="ab-eyebrow">
            <span /> How we work together
          </p>
          <h2>Structured so one team feels like one team</h2>
        </div>
        <ul className="tm-values-list">
          {VALUES.map((value, index) => (
            <li key={value.title}>
              <span className="tm-values-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function TeamMatcher() {
  const [phase, setPhase] = useState<"idle" | "spinning" | "result">("idle");
  const [index, setIndex] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  function spin() {
    if (phase === "spinning") return;
    setSpinCount((c) => c + 1);
    setPhase("spinning");
    const finalIndex = Math.floor(Math.random() * TEAM.length);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIndex(finalIndex);
      setPhase("result");
      return;
    }

    const totalTicks = 16;
    let tick = 0;
    let delay = 70;
    const step = () => {
      const id = window.setTimeout(() => {
        tick += 1;
        if (tick >= totalTicks) {
          setIndex(finalIndex);
          setPhase("result");
          return;
        }
        setIndex((i) => (i + 1) % TEAM.length);
        delay += 12;
        step();
      }, delay);
      timeoutsRef.current.push(id);
    };
    step();
  }

  const person = TEAM[index]!;
  const photo = TEAM_PHOTOS[person.photo];

  return (
    <section className="tm-matcher">
      <Container size="wide">
        <div className="tm-matcher-card" data-phase={phase}>
          <p className="ab-eyebrow">
            <span /> Not sure who to loop in?
          </p>
          <h2>Spin to meet your match</h2>
          <p className="tm-matcher-lede">
            Every engagement gets one named lead. See who it could be.
          </p>

          <div className="tm-matcher-slot">
            <div className="tm-matcher-avatar">
              {photo ? (
                <img src={photo} alt="" loading="lazy" decoding="async" />
              ) : (
                <span aria-hidden="true">{person.initials}</span>
              )}
            </div>
            <div className="tm-matcher-name">{person.name}</div>
            <div className="tm-matcher-role">{person.role}</div>
          </div>

          {phase === "result" ? (
            <div className="tm-matcher-result" aria-live="polite">
              <span className="tm-matcher-confetti" key={spinCount} aria-hidden="true">
                {Array.from({ length: 10 }).map((_, i) => (
                  <i key={i} />
                ))}
              </span>
              <p>{person.blurb}</p>
              <div className="tm-matcher-actions">
                <Link to="/contact" className="ab-btn ab-btn-primary">
                  Start with {person.name.split(" ")[0]} <ArrowRight aria-hidden="true" />
                </Link>
                <button type="button" className="tm-matcher-again" onClick={spin}>
                  <Shuffle aria-hidden="true" /> Spin again
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ab-btn ab-btn-primary"
              onClick={spin}
              disabled={phase === "spinning"}
            >
              <Shuffle aria-hidden="true" /> {phase === "spinning" ? "Spinning…" : "Spin it"}
            </button>
          )}
        </div>
      </Container>
    </section>
  );
}

function Team() {
  const [department, setDepartment] = useState("All");

  return (
    <section className="ab-team" id="team">
      <Container size="wide">
        {DEPARTMENTS.length > 2 ? (
          <div className="tm-dept-tabs" role="group" aria-label="Filter the roster by discipline">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                aria-pressed={department === dept}
                className={department === dept ? "active" : undefined}
                onClick={() => setDepartment(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
        ) : null}
        <TeamShowcase
          key={department}
          eyebrow="The roster"
          title="Tap a card to see what they own."
          filter={(p: Person) => department === "All" || classifyDepartment(p.role) === department}
        />
        <p className="ab-team-line">
          Want the full picture of how {BRAND.name} works?{" "}
          <Link to="/about">
            Read about our agency <ArrowUpRight aria-hidden="true" className="inline size-4" />
          </Link>
        </p>
      </Container>
    </section>
  );
}
