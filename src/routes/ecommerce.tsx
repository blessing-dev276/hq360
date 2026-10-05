import { createFileRoute } from "@tanstack/react-router";
import { getIndustry } from "@/data/industries";
import { industryHead } from "@/lib/page-heads";
import { INDUSTRY_HEADS } from "@/data/industry-heads";
import { IndustryPage } from "@/components/site/IndustryPage";
import { EcommerceSections } from "@/components/site/EcommerceSections";

export const Route = createFileRoute("/ecommerce")({
  head: () => industryHead(INDUSTRY_HEADS["ecommerce"]!),
  component: RouteComponent,
});

function RouteComponent() {
  const industry = getIndustry("ecommerce")!;
  return <IndustryPage industry={industry} beforeCta={<EcommerceSections />} />;
}
