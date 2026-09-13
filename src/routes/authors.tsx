import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { industryHead } from "@/lib/page-heads";
import { AuthorsJourney } from "@/components/site/AuthorsJourney";
import { FeaturedAuthor } from "@/components/site/FeaturedAuthor";
import { LaunchFilm } from "@/components/site/LaunchFilm";
import { Container, SectionHeader } from "@/components/site/Primitives";
import { REVIEW_SHOTS } from "@/data/proof";

const industry = getIndustry("authors")!;

export const Route = createFileRoute("/authors")({
  head: () => industryHead(industry),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AuthorsJourney
      industry={industry}
      proof={
        <>
          <LaunchFilm />
          <FeaturedAuthor />
          <section className="border-y border-border bg-secondary/40 py-16 sm:py-20">
            <Container size="wide">
              <SectionHeader
                eyebrow="Discovery proof"
                title="Real reviews, not invented numbers"
                intro="Verified reader reviews from real projects — including movement on Goodreads Listopia lists, the kind of signal Goodreads Discovery & Listopia Strategy is built to support. We don't publish specific ranking numbers without a verified before/after for that title."
              />
              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {REVIEW_SHOTS.map((shot) => (
                  <li
                    key={shot.src}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-editorial"
                  >
                    <img src={shot.src} alt={shot.alt} loading="lazy" className="w-full" />
                    <p className="px-4 py-3 text-sm text-muted-foreground">{shot.caption}</p>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        </>
      }
    />
  );
}
