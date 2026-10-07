import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";
import type { AudiencePackage, ServicePrice } from "@/data/pricing";

export function ServicePriceCard({ item }: { item: ServicePrice }) {
  return (
    <article className="flex h-full flex-col border-t border-brand pt-5">
      <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
        Service starting price
      </p>
      <h3 className="mt-3 text-2xl">{item.name}</h3>
      <p className="mt-4 text-3xl font-semibold">
        From {item.price}
        <span className="ml-2 text-sm font-normal text-muted-foreground">/ {item.unit}</span>
      </p>
      <p className="mt-4 text-sm leading-relaxed">{item.included}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.note}</p>
      <Link
        to="/services/$slug"
        params={{ slug: item.serviceSlug }}
        className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:underline"
      >
        Explore service <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

export function AudiencePackageCard({
  item,
  compact = false,
}: {
  item: AudiencePackage;
  compact?: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 sm:p-7">
      <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
        {item.audience}
      </p>
      <h3 className="mt-3 text-2xl">{item.name}</h3>
      <p className="mt-3 text-sm text-muted-foreground">{item.summary}</p>
      <p className="mt-6 text-3xl font-semibold">
        From {item.price}
        <span className="ml-2 text-sm font-normal text-muted-foreground">/ {item.unit}</span>
      </p>
      <ul className="mt-5 space-y-3">
        {item.items.map((part) => (
          <li key={part} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            {part}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{item.note}</p>
      <Link
        to={compact ? `/${item.slug}#project-inquiry` : `/${item.slug}`}
        className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:underline"
      >
        {compact ? "Discuss this package" : `Explore ${item.audience}`}
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}
