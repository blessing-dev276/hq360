import { createFileRoute } from "@tanstack/react-router";
import { WebsiteAudit } from "@/components/site/WebsiteAudit";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/tools/website-audit")({
  head: () =>
    buildSeo(
      {
        title: "Website Audit | HQ360",
        description:
          "Request a preliminary, evidence-led assessment of your website's speed, SEO, conversion paths and tracking.",
        path: "/tools/website-audit",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Website Audit", path: "/tools/website-audit" },
      ]),
    ),
  component: WebsiteAudit,
});
