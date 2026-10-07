import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { IndustryPage } from "@/components/site/IndustryPage";
import { industryHead } from "@/lib/page-heads";
import { INDUSTRY_HEADS } from "@/data/industry-heads";

export const Route = createFileRoute("/roofers")({
  head: () => industryHead(INDUSTRY_HEADS["roofers"]!),
  component: RouteComponent,
});

function RouteComponent() {
  const industry = getIndustry("roofers")!;
  return <IndustryPage industry={industry} />;
}
