import { AUDIENCES, CORE_SERVICES, SERVICE_REDIRECTS } from "@/data/agency";
import { AUTHOR_OFFERS } from "@/data/author-offers";
import { CAPABILITIES } from "@/data/capabilities";
import { FREE_TOOLS } from "@/data/free-tools";
import { INDUSTRIES } from "@/data/industries";
import { INSIGHTS } from "@/data/insights";
import { ANSWERS, GUIDES } from "@/data/insights-hub";
import { absolute } from "@/lib/seo";

/** Only canonical, indexable public pages; redirects and sample work stay out. */
export const STATIC_SITEMAP_PATHS = [
  "/",
  "/tools",
  ...FREE_TOOLS.map((tool) => `/tools/${tool.slug}`),
  "/about",
  "/experts",
  "/expert-signup",
  "/contact",
  "/services",
  "/resources",
  ...AUTHOR_OFFERS.map((offer) => `/services/${offer.slug}`),
  "/industries",
  "/work",
  "/tools/author-visibility-audit",
  "/book-launch",
  "/faqs",
  "/insights/glossary",
  "/privacy",
  "/terms",
  ...CORE_SERVICES.map((item) => `/services/${item.slug}`),
  ...AUDIENCES.map((item) => `/${item.slug}`),
  ...CAPABILITIES.filter((item) => !SERVICE_REDIRECTS[item.slug]).map((item) => item.path),
  ...INDUSTRIES.filter((item) => !["/creators", "/local-business"].includes(item.path)).map(
    (item) => item.path,
  ),
  ...INSIGHTS.map((item) => `/insights/${item.slug}`),
  ...GUIDES.map((item) => `/insights/guides/${item.slug}`),
  ...ANSWERS.map((item) => `/insights/answers/${item.slug}`),
];

export function renderSitemap(projectPaths: string[]) {
  const escapeXml = (value: string) =>
    value.replace(
      /[<>&"']/g,
      (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!,
    );
  const urls = [...new Set([...STATIC_SITEMAP_PATHS, ...projectPaths])];
  // No fabricated lastmod dates: add only when real per-page modification dates exist.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${escapeXml(absolute(path))}</loc></url>`).join("\n")}\n</urlset>\n`;
}
