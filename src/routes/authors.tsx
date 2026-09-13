import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { industryHead } from "@/lib/page-heads";
import { AuthorsJourney } from "@/components/site/AuthorsJourney";
import { FeaturedAuthor } from "@/components/site/FeaturedAuthor";
import { LaunchFilm } from "@/components/site/LaunchFilm";
import { PortfolioStrip } from "@/components/site/PortfolioStrip";
import { TestimonialStrip } from "@/components/site/TestimonialStrip";

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
              real delivered work: campaigns, websites, case studies. */}
          <PortfolioStrip
            industry={industry.slug}
            eyebrow="Selected work"
            title="Real work, not invented numbers"
          />
          {/* Admin-managed from /admin > Testimonials (filtered to this
              industry) — review screenshots, kept separate from portfolio
              work. Add more, or tag one to a specific service, from there. */}
          <TestimonialStrip
            industry={industry.slug}
            eyebrow="What authors say"
            title="Testimonials"
            tone="raised"
          />
        </>
      }
    />
  );
}
