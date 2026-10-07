import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { CAPABILITIES } from "@/data/capabilities";
import { OrbitGraphic } from "@/components/brand/OrbitGraphic";
import { Reveal } from "@/components/site/Reveal";

export function CapabilityGrid({ limit }: { limit?: number }) {
  const items = limit ? CAPABILITIES.slice(0, limit) : CAPABILITIES;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c, i) => (
        <li key={c.slug}>
          <Reveal delay={i * 40} className="h-full">
            <Link
              to={c.path}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between">
                <span className="size-11 text-foreground/70">
                  <OrbitGraphic />
                </span>
                <ArrowUpRight
                  className="size-5 text-muted-foreground transition-colors group-hover:text-brand"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-5 font-display text-lg">{c.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {c.tagline}
              </p>
              <span className="mt-5 text-sm font-semibold text-brand">Explore service</span>
            </Link>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
