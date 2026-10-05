import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CASE_STUDIES, type CaseStudy } from "@/data/work";
import { getCapability } from "@/data/capabilities";
import { SampleBadge } from "@/components/site/Primitives";
import { Reveal } from "@/components/site/Reveal";
import { fetchPublicContent } from "@/lib/public-content";
import { toCaseStudyShape, type SerializedCaseStudy } from "@/lib/case-study-view";

/** Route-provided published studies cover SSR; browser queries keep the list fresh. */
function useCaseStudies(initialStudies?: CaseStudy[]): CaseStudy[] {
  const query = useQuery({
    queryKey: ["public", "case-studies"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: SerializedCaseStudy[] }>("/api/public/case-studies", signal),
  });
  return query.data?.items
    ? query.data.items.map((r) => toCaseStudyShape(r) as CaseStudy)
    : (initialStudies ?? CASE_STUDIES);
}

export function WorkGrid({ initialStudies }: { initialStudies?: CaseStudy[] }) {
  const studies = useCaseStudies(initialStudies);
  const industries = useMemo(
    () => ["All", ...Array.from(new Set(studies.map((c) => c.industry).filter(Boolean)))],
    [studies],
  );
  const [industry, setIndustry] = useState("All");

  const shown = industry === "All" ? studies : studies.filter((c) => c.industry === industry);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter work by industry">
        {industries.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndustry(i)}
            aria-pressed={industry === i}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              industry === i
                ? "border-transparent bg-charcoal text-[oklch(0.97_0.006_90)]"
                : "border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground",
            )}
          >
            {i}
          </button>
        ))}
      </div>

      <ul className="mt-10 grid gap-6 lg:grid-cols-2">
        {shown.map((c, idx) => (
          <li key={c.slug}>
            <Reveal delay={idx * 40} className="h-full">
              <CaseStudyCard study={c} />
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaseStudyCard({ study }: { study: CaseStudy }) {
  return (
    <Link
      to="/work/$slug"
      params={{ slug: study.slug }}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-8"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {study.industry}
        </span>
        {study.status === "sample" ? <SampleBadge /> : null}
      </div>
      <h2 className="mt-3 font-display text-xl leading-snug">{study.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{study.client}</p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{study.summary}</p>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {study.capabilities.map((slug) => {
          const cap = getCapability(slug);
          return cap ? (
            <span
              key={slug}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground/70"
            >
              {cap.label}
            </span>
          ) : null;
        })}
      </div>
      <span className="mt-6 text-sm font-semibold text-brand">
        {study.status === "verified" ? "View project" : "See how it is structured"}
      </span>
    </Link>
  );
}
