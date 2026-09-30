import type { PointerEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, type PublicExpert } from "@/lib/experts";
import "./hqd.css";

type PillTone = "light" | "orange" | "dark" | "ghost";

export function Pill({
  to,
  href,
  children,
  tone = "light",
  className,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  const classes = cn("hqd-pill", tone !== "light" && `hqd-pill--${tone}`, className);
  const inner = (
    <>
      <span>{children}</span>
      <span className="hqd-pill-dot" aria-hidden="true">
        <ArrowUpRight size={17} strokeWidth={2.4} />
      </span>
    </>
  );
  if (to)
    return (
      <Link to={to} preload="intent" className={classes}>
        {inner}
      </Link>
    );
  return (
    <a href={href} className={classes}>
      {inner}
    </a>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="hqd-eyebrow">{children}</p>;
}

export function Num({ n }: { n: number }) {
  return (
    <span className="hqd-num">
      <em>#</em>
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** Tracks the pointer so .hqd-card can paint a spotlight under the cursor. */
export function spotlight(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

export function Grain() {
  return <span className="hqd-grain" aria-hidden="true" />;
}

export function PersonCard({ person }: { person: PublicExpert }) {
  return (
    <Link to="/experts/$slug" params={{ slug: person.slug }} className="hqd-person">
      <div className="hqd-person-photo">
        {person.photo ? (
          <img src={person.photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="hqd-person-initials" aria-hidden="true">
            {initials(person.name)}
          </span>
        )}
      </div>
      <span className="hqd-chip">{person.kind === "team" ? "HQ360 team" : "Expert"}</span>
      <div className="hqd-person-meta">
        <span>
          <strong>{person.name}</strong>
          <small>{person.headline}</small>
        </span>
        <span className="hqd-person-go" aria-hidden="true">
          <ArrowUpRight size={17} strokeWidth={2.4} />
        </span>
      </div>
    </Link>
  );
}
