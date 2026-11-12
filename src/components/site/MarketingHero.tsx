import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, Check } from "lucide-react";
import thumb1 from "@/assets/team-hero-1-thumb.webp";
import thumb2 from "@/assets/team-hero-2-thumb.webp";
import thumb3 from "@/assets/team-hero-3-thumb.webp";
import thumb4 from "@/assets/team-hero-4-thumb.webp";
import "./marketing-hero.css";

type HeroAction = { label: string; href: string };
const TEAM_PORTRAITS = [thumb1, thumb2, thumb3, thumb4];
const DEFAULT_HIGHLIGHTS = [
  "One connected team",
  "A clear project scope",
  "Support from start to launch",
];

function HeroLink({ action, secondary = false }: { action: HeroAction; secondary?: boolean }) {
  const className = `marketing-hero__button${secondary ? " marketing-hero__button--secondary" : ""}`;
  const icon =
    secondary && action.href.startsWith("#") ? (
      <ArrowDown size={16} aria-hidden="true" />
    ) : (
      <ArrowUpRight size={17} aria-hidden="true" />
    );
  const content = (
    <>
      {action.label}
      {icon}
    </>
  );
  return action.href.startsWith("#") ? (
    <a href={action.href} className={className}>
      {content}
    </a>
  ) : (
    <Link to={action.href} className={className}>
      {content}
    </Link>
  );
}

/** Shared, server-rendered first screen for the homepage, services and industries. */
export function MarketingHero({
  eyebrow,
  title,
  description,
  primary,
  secondary,
  highlights = DEFAULT_HIGHLIGHTS,
  proofLabel = "One connected team. Every angle.",
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  primary: HeroAction;
  secondary: HeroAction;
  highlights?: string[];
  proofLabel?: string;
}) {
  return (
    <section className="marketing-hero" aria-labelledby="marketing-hero-title">
      <div className="marketing-hero__content">
        <p className="marketing-hero__eyebrow">
          <span aria-hidden="true" />
          {eyebrow}
        </p>
        <Link to="/experts" className="marketing-hero__team" aria-label="Meet the HQ360 team">
          <span className="marketing-hero__faces" aria-hidden="true">
            {TEAM_PORTRAITS.map((src) => (
              <img key={src} src={src} alt="" width={38} height={38} decoding="async" />
            ))}
          </span>
          <span>
            {proofLabel}
            <small>
              Meet the people behind your next project <ArrowUpRight size={12} aria-hidden="true" />
            </small>
          </span>
        </Link>
        <h1 id="marketing-hero-title" className="marketing-hero__title">
          {title}
        </h1>
        <p className="marketing-hero__description">{description}</p>
        <div className="marketing-hero__actions">
          <HeroLink action={primary} />
          <HeroLink action={secondary} secondary />
        </div>
        <p className="marketing-hero__note">
          A clear brief. A shared plan. A great place to start.
        </p>
      </div>
      <div className="marketing-hero__light" aria-hidden="true">
        <span />
      </div>
      <div className="marketing-hero__footer">
        <p>Good work starts with the right team.</p>
        <ul>
          {highlights.map((item) => (
            <li key={item}>
              <Check size={15} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
