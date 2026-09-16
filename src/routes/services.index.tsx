import { createFileRoute } from "@tanstack/react-router";
import { CapabilitiesPage } from "./capabilities.index";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/services/")({
  head: () =>
    buildSeo(
      {
        title: "Services — What HQ360 Does | HQ360",
        description:
          "Nine services spanning brand, websites, CRM automation, marketing, content, writing and translation, SEO, mobile apps and game development.",
        path: "/services",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
      ]),
    ),
  component: CapabilitiesPage,
});
