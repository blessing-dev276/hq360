import { BRAND, SOCIALS } from "@/config/brand";
import { TRUSTPILOT } from "@/data/trustpilot";

type MetaTag = Record<string, string>;
type LinkTag = Record<string, string>;
type ScriptTag = { type: string; children: string };

export type SeoInput = {
  title: string;
  description: string;
  /** Absolute path beginning with "/" — used for canonical + og:url. */
  path: string;
  type?: "website" | "article" | "profile";
  /** Absolute or root-relative image URL for social cards. */
  image?: string;
  /** og:image:alt / twitter:image:alt. Defaults to the page title when a
   * custom `image` is set, or "HQ360" for the default favicon fallback. */
  imageAlt?: string;
  noindex?: boolean;
};

export function absolute(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${BRAND.siteUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Content-driven meta descriptions (a case study's summary, an admin-entered
 * field, etc.) have no length limit where they're authored, but a
 * <meta name="description"> does — Google generally shows ~155-160 chars and
 * cuts the rest mid-sentence. Truncate at the last whole word inside the
 * limit rather than editing the source content.
 */
export function truncateDescription(text: string, max = 155): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Build a consistent head config for a route: title, description, canonical,
 * Open Graph and Twitter tags. Optionally attaches JSON-LD structured data.
 */
export function buildSeo(
  input: SeoInput,
  structuredData?: unknown | unknown[],
): { meta: MetaTag[]; links: LinkTag[]; scripts?: ScriptTag[] } {
  const url = absolute(input.path);
  const image = absolute(input.image ?? "/favicon.png");
  const fullTitle = input.title.includes("HQ360") ? input.title : `${input.title} | HQ360`;
  const imageAlt = input.imageAlt ?? (input.image ? fullTitle : "HQ360");

  const meta: MetaTag[] = [
    { title: fullTitle },
    { name: "description", content: input.description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];

  if (input.noindex) meta.push({ name: "robots", content: "noindex, follow" });

  const links: LinkTag[] = [{ rel: "canonical", href: url }];

  const result: { meta: MetaTag[]; links: LinkTag[]; scripts?: ScriptTag[] } = { meta, links };

  if (structuredData) {
    const blocks = Array.isArray(structuredData) ? structuredData : [structuredData];
    result.scripts = blocks.map((block) => ({
      type: "application/ld+json",
      children: serializeJsonLd(block),
    }));
  }

  return result;
}

/** Organization schema — safe to include site-wide. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: BRAND.name,
    logo: absolute("/logo-abstract.png"),
    sameAs: SOCIALS.map((social) => social.href),
    url: BRAND.siteUrl,
    description: BRAND.positioning,
    slogan: BRAND.tagline,
    email: BRAND.email,
    areaServed: "Worldwide",
    // Real figures from https://www.trustpilot.com/review/hq360.space — update
    // src/data/trustpilot.ts by hand as reviews come in; never round up.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: TRUSTPILOT.trustScore,
      reviewCount: TRUSTPILOT.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  };
}

/** A service offered by HQ360, not a separate local business or office. */
export function serviceSchema(input: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${BRAND.name} — ${input.name}`,
    description: input.description,
    url: absolute(input.path),
    areaServed: "Worldwide",
    provider: { "@id": absolute("/#organization") },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbSchema(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absolute(c.path),
    })),
  };
}

/** Escape HTML delimiters in managed content before embedding JSON-LD. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
