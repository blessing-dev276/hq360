import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { IndustryPage } from "@/components/site/IndustryPage";
import { industryHead } from "@/lib/page-heads";
import { INDUSTRY_HEADS } from "@/data/industry-heads";

export const Route = createFileRoute("/law-firms")({
  head: () => industryHead(INDUSTRY_HEADS["law-firms"]!),
  component: RouteComponent,
});

function RouteComponent() {
  const industry = getIndustry("law-firms")!;
  return <IndustryPage industry={industry} />;
}
