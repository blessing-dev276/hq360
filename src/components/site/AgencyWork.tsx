import { LoadingRegion, SkeletonCard, SkeletonGrid } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicContent } from "@/lib/public-content";
import { toCaseStudyShape, type SerializedCaseStudy } from "@/lib/case-study-view";
import { CASE_STUDIES, type CaseStudy } from "@/data/work";
import { CORE_SERVICES, AUDIENCES } from "@/data/agency";
import {
  buildAgencyProof,
  filterAgencyProof,
  selectAgencyProof,
  proofServiceLabel,
  type PortfolioProof,
} from "@/lib/agency-work";
export function AgencyWork({
  service = "",
  audience = "",
  limit,
  filters = false,
}: {
  service?: string;
  audience?: string;
  limit?: number;
  filters?: boolean;
}) {
  const [chosenService, setService] = useState("");
  const [chosenAudience, setAudience] = useState("");
  const portfolio = useQuery({
    queryKey: ["agency", "portfolio"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: PortfolioProof[] }>("/api/public/portfolio", signal),
  });
  const cases = useQuery({
    queryKey: ["public", "case-studies"],
    queryFn: ({ signal }) =>
      fetchPublicContent<{ items: SerializedCaseStudy[] }>("/api/public/case-studies", signal),
  });
  const studies =
    cases.data?.items.map((item) => toCaseStudyShape(item) as CaseStudy) ?? CASE_STUDIES;
  const items = buildAgencyProof(portfolio.data?.items ?? [], studies);
  const filtered = filterAgencyProof(items, service || chosenService, audience || chosenAudience);
  const shown = limit ? selectAgencyProof(filtered, limit) : filtered;
  return (
    <div>
      {filters && (
        <div className="my-6 flex flex-wrap gap-5">
          <label className="text-sm">
            Service
            <select
              className="ml-3 rounded-lg border border-border bg-background p-2"
              aria-label="Service"
              value={chosenService}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">All services</option>
              {CORE_SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
              {["author-visibility", "book-formatting", "creative-video", "book-launch"].map(
                (s) => (
                  <option key={s} value={s}>
                    {proofServiceLabel(s)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-sm">
            Audience
            <select
              className="ml-3 rounded-lg border border-border bg-background p-2"
              aria-label="Audience"
              value={chosenAudience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="">All audiences</option>
              {AUDIENCES.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
              {[...new Set(items.map((i) => i.audience))]
                .filter((a) => !AUDIENCES.some((item) => item.slug === a))
                .map((a) => (
                  <option key={a} value={a}>
                    {items.find((i) => i.audience === a)?.audienceLabel}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      {(portfolio.isPending || cases.isPending) && (
        <LoadingRegion label="Loading published work" className="my-6">
          <SkeletonGrid count={3} min="18rem">
            <SkeletonCard media />
          </SkeletonGrid>
        </LoadingRegion>
      )}
      {(portfolio.isError || cases.isError) && (
        <p role="status" className="my-6 text-sm">
          Some published work could not load.{" "}
          <button
            className="underline"
            onClick={() => {
              void portfolio.refetch();
              void cases.refetch();
            }}
          >
            Try again
          </button>
        </p>
      )}
      {shown.length ? (
        <ul className="mt-8 grid gap-8 md:grid-cols-2">
          {shown.map((item) => (
            <li key={item.id} className="min-w-0 border-b border-border pb-7">
              {item.video ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={item.image}
                  src={item.video}
                  className="aspect-[16/10] w-full rounded-xl bg-secondary object-contain"
                />
              ) : item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="aspect-[16/10] w-full rounded-xl bg-secondary object-cover object-top"
                />
              ) : null}
              <p className="mt-5 text-xs font-semibold text-brand">
                {item.services.map(proofServiceLabel).join(" · ") || "Project work"} /{" "}
                {item.audienceLabel}
              </p>
              <h3 className="mt-2 text-xl">{item.title}</h3>
              {item.description && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              )}
              {item.href && (
                <a
                  href={item.href}
                  {...(item.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
                >
                  {item.href.startsWith("/work/") ? "Read the project" : "Visit project"} →
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : !portfolio.isPending && !cases.isPending && !portfolio.isError && !cases.isError ? (
        <p className="my-8 max-w-2xl border-l-2 border-brand pl-5 text-muted-foreground">
          No published examples match this selection yet. We can discuss the proposed approach and
          what evidence is available before you decide to proceed.
        </p>
      ) : null}
    </div>
  );
}
