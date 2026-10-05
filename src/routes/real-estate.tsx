import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { IndustryPage } from "@/components/site/IndustryPage";
import { industryHead } from "@/lib/page-heads";
import { INDUSTRY_HEADS } from "@/data/industry-heads";

export const Route = createFileRoute("/real-estate")({
  head: () => industryHead(INDUSTRY_HEADS["real-estate"]!),
  component: RouteComponent,
});

function RouteComponent() {
  const industry = getIndustry("real-estate")!;
  return <IndustryPage industry={industry} />;
}
