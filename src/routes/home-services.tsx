import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { IndustryPage } from "@/components/site/IndustryPage";
import { industryHead } from "@/lib/page-heads";
import { INDUSTRY_HEADS } from "@/data/industry-heads";

export const Route = createFileRoute("/home-services")({
  head: () => industryHead(INDUSTRY_HEADS["home-services"]!),
  component: RouteComponent,
});

function RouteComponent() {
  const industry = getIndustry("home-services")!;
  return <IndustryPage industry={industry} />;
}
