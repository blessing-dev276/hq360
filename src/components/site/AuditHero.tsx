import { useEffect, useState } from "react";
import { ArrowRight, Check, Radar } from "lucide-react";
import { Container, Eyebrow } from "@/components/site/Primitives";
import "./audit-hero.css";

/**
 * Shared centered hero for the audit tools (Author Visibility Audit, Website
 * Audit). The step strip auto-cycles like the homepage growth loop, and is
 * also hoverable/clickable — decorative, not a real-time status.
 */
export function AuditHero({
  eyebrow,
  title,
  lede,
  chips,
  steps,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  chips: string[];
  steps: readonly (readonly [string, string])[];
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActive((a) => (a + 1) % steps.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <section className="aud-hero">
      <div className="aud-hero-grid" aria-hidden="true" />
      <Container className="relative z-10">
        <div className="aud-hero-copy">
          <span className="aud-hero-badge" aria-hidden="true">
            <Radar />
          </span>
          <Eyebrow className="justify-center">{eyebrow}</Eyebrow>
          <h1 className="aud-hero-title">{title}</h1>
          <p className="aud-hero-lede">{lede}</p>
          <ul className="aud-hero-chips">
            {chips.map((chip) => (
              <li key={chip}>
                <Check aria-hidden="true" /> {chip}
              </li>
            ))}
          </ul>
        </div>

        <ol className="aud-hero-steps" role="tablist" aria-label="How the audit works">
          {steps.map(([number, label], index) => (
            <li key={number}>
              <button
                type="button"
                role="tab"
                aria-selected={index === active}
                className={index === active ? "active" : undefined}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
              >
                <span className="aud-step-num">{number}</span>
                <span>{label}</span>
              </button>
              {index < steps.length - 1 ? <span className="aud-step-line" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        <a href="#audit-form" className="aud-hero-cta">
          Start your audit <ArrowRight aria-hidden="true" />
        </a>
      </Container>
    </section>
  );
}
