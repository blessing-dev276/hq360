import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Grain } from "./hqd/Hqd";

/** Max-width page gutter. */
export function Container({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
}) {
  return (
    <div
      className={cn(
        "mx-auto px-5 sm:px-6 lg:px-8",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-7xl",
        size === "wide" && "max-w-[88rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  tone = "base",
  id,
  bleed = false,
}: {
  children: ReactNode;
  className?: string;
  /** "hero" renders the orange page hero panel; use it for a page's first section. */
  tone?: "base" | "raised" | "dark" | "carbon" | "hero";
  id?: string;
  /** Skip the Container wrapper (caller controls width). */
  bleed?: boolean;
}) {
  const hero = tone === "hero";
  return (
    <section
      id={id}
      className={cn(
        !hero && "py-16 sm:py-20 lg:py-28",
        hero && "hqd-hero-section",
        tone === "raised" && "hqd-tone-raised",
        (tone === "dark" || tone === "carbon") && "hqd-tone-dark",
        className,
      )}
    >
      {hero && (
        <>
          <span className="hqd-hero-glow" aria-hidden="true" />
          <span className="hqd-hero-shade" aria-hidden="true" />
          <Grain />
        </>
      )}
      {bleed ? children : <Container className={hero ? "relative" : ""}>{children}</Container>}
    </section>
  );
}

export function Eyebrow({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "muted" | "light";
  className?: string;
}) {
  return (
    <p className={cn("hqd-eyebrow", tone === "muted" && "hqd-eyebrow--muted", className)}>
      {children}
    </p>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "left",
  className,
  as: TitleTag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  /** Kept for existing callers; every section now renders on the dark canvas. */
  tone?: "base" | "light";
  className?: string;
  as?: "h1" | "h2";
}) {
  const h1 = TitleTag === "h1";
  const long = typeof title === "string" && title.length > 42;
  return (
    <div
      className={cn(
        h1 ? "max-w-5xl" : "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <TitleTag
        className={cn(
          "hqd-title",
          h1 ? "hqd-title--h1" : "hqd-title--h2",
          h1 && long && "hqd-title--long",
        )}
      >
        {title}
      </TitleTag>
      {intro ? (
        <p
          className={cn(
            "hqd-intro",
            h1 ? "max-w-2xl" : "max-w-2xl",
            align === "center" && "mx-auto",
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "light";
type ButtonSize = "md" | "lg";

function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string) {
  if (variant === "ghost") return cn("hqd-text-link", className);
  return cn(
    "hqd-pill",
    (variant === "secondary" || variant === "light") && "hqd-pill--ghost",
    size === "md" && "hqd-pill--sm",
    "disabled:opacity-60 disabled:pointer-events-none",
    className,
  );
}

function ButtonInner({ children, variant }: { children: ReactNode; variant: ButtonVariant }) {
  if (variant === "ghost")
    return (
      <>
        {children}
        <ArrowUpRight size={16} aria-hidden="true" />
      </>
    );
  return (
    <>
      <span>{children}</span>
      <span className="hqd-pill-dot" aria-hidden="true">
        <ArrowUpRight size={17} strokeWidth={2.4} />
      </span>
    </>
  );
}

export function ButtonLink({
  to,
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
  ...rest
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} & Partial<ComponentProps<"a">>) {
  if (to) {
    return (
      <Link to={to} className={buttonClasses(variant, size, className)}>
        <ButtonInner variant={variant}>{children}</ButtonInner>
      </Link>
    );
  }
  return (
    <a href={href} className={buttonClasses(variant, size, className)} {...rest}>
      <ButtonInner variant={variant}>{children}</ButtonInner>
    </a>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "lg",
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} & ComponentProps<"button">) {
  return (
    <button
      className={cn(buttonClasses(variant, size, className), "cursor-pointer")}
      style={{ border: 0 }}
      {...rest}
    >
      <ButtonInner variant={variant}>{children}</ButtonInner>
    </button>
  );
}

/** Small visible marker for illustrative / placeholder content. */
export function SampleBadge({
  children = "Illustrative",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide text-[#ffb37a] uppercase",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      {children}
    </span>
  );
}

export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 text-xs tracking-wide text-muted-foreground/80 uppercase">{children}</p>
  );
}
