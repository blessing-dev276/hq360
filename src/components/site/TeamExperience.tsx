import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { TeamShowcase } from "@/components/site/TeamShowcase";
import { TEAM } from "@/data/team";
import { BRAND, CTAS } from "@/config/brand";
import "./about.css";
import "./team.css";

export function TeamExperience() {
  return (
    <div className="ab tm">
      <TeamHero />
      <TeamStats />
      <TeamValues />
      <Team />
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
        <div className="ab-hero-copy">
          <p className="ab-eyebrow">
            <span /> Meet the team
          </p>
          <h1>The people on your account</h1>
          <p className="ab-hero-lede">
            A small multidisciplinary team &mdash; every discipline in-house, one named lead per
            engagement. No account managers relaying work between vendors.
          </p>
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

function Team() {
  return (
    <section className="ab-team" id="team">
      <Container size="wide">
        <TeamShowcase eyebrow="The roster" title="Tap a card to see what they own." />
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
