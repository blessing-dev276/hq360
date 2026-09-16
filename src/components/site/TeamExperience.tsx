import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { TeamShowcase } from "@/components/site/TeamShowcase";
import { BRAND, CTAS } from "@/config/brand";
import "./about.css";

export function TeamExperience() {
  return (
    <div className="ab">
      <TeamHero />
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

function Team() {
  return (
    <section className="ab-team" id="team">
      <Container size="wide">
        <TeamShowcase
          eyebrow="The team"
          title={
            <>
              Tap a card to see what they own.
            </>
          }
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
