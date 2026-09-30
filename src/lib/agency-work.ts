import { CORE_SERVICES, AUDIENCES } from "@/data/agency";
import { CASE_STUDIES, type CaseStudy } from "@/data/work";
export type PortfolioProof = {
  id: string;
  title: string;
  description: string | null;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
  capability_slug: string | null;
  industry_slug: string | null;
  external_link: string | null;
};
export type AgencyProof = {
  id: string;
  title: string;
  description: string;
  services: string[];
  audience: string;
  audienceLabel: string;
  image?: string;
  video?: string;
  href?: string;
};
export const proofServiceLabel = (slug: string) =>
  CORE_SERVICES.find((item) => item.slug === slug)?.name ??
  {
    "author-visibility": "Author Visibility & Marketing",
    "book-formatting": "Book Formatting & Publishing Support",
    "creative-video": "Creative & Video",
    "book-launch": "Book Launch Support",
  }[slug] ??
  "Project work";
const aliases: Record<string, string> = {
  "websites-funnels": "website-development",
  "crm-automation": "automation-crm",
  "writing-translation": "writing-editing",
  "brand-creative": "creative-video",
  "content-social": "creative-video",
  "visibility-reputation": "author-visibility",
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function serviceTags(title: string, tags: string[]) {
  // Published metadata contains known misclassifications. Describe the actual work, not an inferred capability.
  if (/goodreads|listopia/i.test(title)) return ["author-visibility"];
  if (/interior.*format|formatting.*layout/i.test(title)) return ["book-formatting"];
  if (/launch day/i.test(title)) return ["book-launch"];
  if (/translat|localiz|localis/i.test(title)) return ["writing-editing"];
  return [...new Set(tags.map((tag) => aliases[tag] ?? tag))];
}
function audience(slug: string) {
  const item = AUDIENCES.find((item) => item.slug === slug || item.proofSlugs.includes(slug));
  return {
    audience: item?.slug ?? slug,
    audienceLabel:
      item?.name ??
      { "real-estate": "Real Estate", ecommerce: "E-commerce" }[slug] ??
      (slug || "Audience not specified"),
  };
}
export function buildAgencyProof(portfolio: PortfolioProof[], studies: CaseStudy[]): AgencyProof[] {
  const results: AgencyProof[] = [];
  const seen = new Set<string>();
  function add(item: AgencyProof) {
    const keys = [normalize(item.title), item.image, item.video].filter(Boolean) as string[];
    if (keys.some((key) => seen.has(key))) return;
    keys.forEach((key) => seen.add(key));
    results.push(item);
  }
  for (const study of studies) {
    if (
      study.status !== "verified" ||
      /illustrative/i.test(`${study.client} ${study.outcome}`) ||
      CASE_STUDIES.some((local) => local.slug === study.slug && local.status === "sample")
    )
      continue;
    const aud = AUDIENCES.find((item) => item.name === study.industry);
    const media = study.media?.length
      ? study.media
      : CASE_STUDIES.find((local) => local.slug === study.slug)?.media;
    const image = media?.find((item) => !item.src.endsWith(".mp4"))?.src;
    add({
      id: study.slug,
      title: study.title,
      description: study.summary,
      services: serviceTags(study.title, study.capabilities),
      ...audience(aud?.slug ?? study.industry),
      ...(image ? { image } : {}),
      href: `/work/${study.slug}`,
    });
  }
  for (const item of portfolio)
    add({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      services: serviceTags(item.title, item.capability_slug ? [item.capability_slug] : []),
      ...audience(item.industry_slug ?? ""),
      ...(item.media_type === "image"
        ? { image: item.media_url }
        : { video: item.media_url, ...(item.thumbnail_url ? { image: item.thumbnail_url } : {}) }),
      ...(item.external_link && /^https?:\/\//.test(item.external_link)
        ? { href: item.external_link }
        : {}),
    });
  return results;
}
export function filterAgencyProof(items: AgencyProof[], service = "", audienceSlug = "") {
  return items.filter(
    (item) =>
      (!service || item.services.includes(service)) &&
      (!audienceSlug || item.audience === audienceSlug),
  );
}
export function selectAgencyProof(items: AgencyProof[], limit: number) {
  const chosen: AgencyProof[] = [];
  const rest = [...items];
  const services = new Set<string>();
  const audiences = new Set<string>();
  while (rest.length && chosen.length < limit) {
    rest.sort(
      (a, b) =>
        Number(!audiences.has(b.audience)) +
        Number(b.services.some((s) => !services.has(s))) -
        (Number(!audiences.has(a.audience)) + Number(a.services.some((s) => !services.has(s)))),
    );
    const next = rest.shift()!;
    chosen.push(next);
    next.services.forEach((s) => services.add(s));
    audiences.add(next.audience);
  }
  return chosen;
}
