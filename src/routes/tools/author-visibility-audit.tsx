import { createFileRoute } from "@tanstack/react-router";
import { AuthorVisibilityAudit } from "@/components/site/AuthorVisibilityAudit";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/tools/author-visibility-audit")({
  head: () =>
    buildSeo(
      {
        title: "Free Author Visibility Check | HQ360",
        description:
          "Request an evidence-led preliminary assessment of how readers discover, evaluate and purchase your book.",
        path: "/tools/author-visibility-audit",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Free Author Visibility Check", path: "/tools/author-visibility-audit" },
      ]),
    ),
  component: AuthorVisibilityAudit,
});
