import { CAPABILITIES } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";
import { INSIGHTS } from "@/data/insights";
import { ANSWERS, GUIDES } from "@/data/insights-hub";
import { absolute } from "@/lib/seo";

/** Only canonical, indexable public pages; redirects and sample work stay out. */
export const STATIC_SITEMAP_PATHS = [
  "/",
  "/about",
  "/team",
  "/contact",
  "/services",
  "/industries",
  "/work",
  "/tools/author-visibility-audit",
  "/book-launch",
  "/faqs",
  "/insights",
  "/insights/glossary",
  "/privacy",
  "/terms",
  ...CAPABILITIES.map((item) => item.path),
  ...INDUSTRIES.map((item) => item.path),
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
