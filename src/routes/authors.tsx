import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { industryHead } from "@/lib/page-heads";
import { AuthorsJourney } from "@/components/site/AuthorsJourney";
import { FeaturedAuthor } from "@/components/site/FeaturedAuthor";
import { LaunchFilm } from "@/components/site/LaunchFilm";
import { PortfolioStrip } from "@/components/site/PortfolioStrip";

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
          {/* Admin-managed from /admin > Portfolio (filtered to this industry) —
              add more review screenshots there, tagged to Authors & Publishers
              and, optionally, a specific service. */}
          <PortfolioStrip
            industry={industry.slug}
            eyebrow="Discovery proof"
            title="Real reviews, not invented numbers"
            tone="raised"
          />
        </>
      }
    />
  );
}
