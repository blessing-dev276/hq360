import { AUDIENCES, CORE_SERVICES, getAudience, getCoreService } from "@/data/agency";
import { AUTHOR_OFFERS } from "@/data/author-offers";
export const INQUIRY_SERVICES = [...CORE_SERVICES, ...AUTHOR_OFFERS];
export function readInquiryContext(search: Record<string, unknown>) {
  const audience =
    typeof search.audience === "string" && getAudience(search.audience) ? search.audience : "";
  const service =
    typeof search.service === "string" &&
    INQUIRY_SERVICES.some((item) => item.slug === search.service)
      ? search.service
      : "";
  const from =
    typeof search.from === "string" &&
    /^\/(?:[a-z0-9-]+\/?)*$/.test(search.from) &&
    search.from.length <= 200
      ? search.from
      : "";
  return {
    ...(audience ? { audience } : {}),
    ...(service ? { service } : {}),
    ...(from ? { from } : {}),
  };
}
export function contextForPath(path: string) {
  const audience = AUDIENCES.find((item) => path === `/${item.slug}`)?.slug ?? "";
  const slug = path.startsWith("/services/") ? (path.split("/")[2] ?? "") : "";
  const offer = AUTHOR_OFFERS.find((item) => item.slug === slug);
  return {
    audience:
      offer || path === "/book-launch" || path === "/tools/author-visibility-audit"
        ? "authors"
        : audience,
    service: getCoreService(slug) || offer ? slug : "",
    from: path,
  };
}
export function inquiryHref(input: { audience?: string; service?: string; from?: string } = {}) {
  const context = readInquiryContext(input);
  const params = new URLSearchParams(Object.entries(context).filter(([, value]) => Boolean(value)));
  return `/contact${params.size ? `?${params}` : ""}`;
}
export function serviceName(slug: string) {
  return INQUIRY_SERVICES.find((item) => item.slug === slug)?.name ?? "";
}
/** Origin context fits existing source_path and source_industry columns; selected values stay separate. */
export function inquirySourcePath(path: string, service: string) {
  return service ? `${path}?service=${encodeURIComponent(service)}` : path;
}
