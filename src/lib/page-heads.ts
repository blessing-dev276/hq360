import type { Industry } from "@/data/industries";
import type { Capability } from "@/data/capabilities";
import { breadcrumbSchema, buildSeo, faqSchema, serviceSchema } from "@/lib/seo";

export function industryHead(industry: Industry) {
  return buildSeo(
    {
      title: industry.seo.title,
      description: industry.seo.description,
      path: industry.path,
      type: "website",
    },
    [
      serviceSchema({
        name: industry.name,
        description: industry.seo.description,
        path: industry.path,
      }),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Industries", path: "/industries" },
        { name: industry.shortName, path: industry.path },
      ]),
      faqSchema(industry.faqs),
    ],
  );
}

export function capabilityHead(capability: Capability) {
  return buildSeo(
    {
      title: capability.seo.title,
      description: capability.seo.description,
      path: capability.path,
      type: "website",
    },
    [
      serviceSchema({
        name: capability.name,
        description: capability.summary,
        path: capability.path,
      }),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
        { name: capability.name, path: capability.path },
      ]),
      faqSchema(capability.faqs),
    ],
  );
}
