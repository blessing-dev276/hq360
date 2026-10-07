import { publicResultUrl } from "./audience-search.server";
import { emailsIn, pageText } from "./perplexity-contact.server";

const PAGE_HINT = /contact|about|connect|reach|press|media|booking|enquir|inquir/i;

/** Free first pass before any paid search: read the author's own website
 *  (home page plus up to 3 contact/about-style pages) and return the emails
 *  published there. */
export async function emailsOnWebsite(website: string | null | undefined, fetcher = fetch) {
  const home = publicResultUrl(website);
  if (!home) return [];
  const homeHtml = await pageText(home, fetcher);
  if (!homeHtml) return [];
  const host = new URL(home).hostname;
  const links = new Set<string>();
  for (const [, href] of homeHtml.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(href!, home);
      if (url.hostname === host && PAGE_HINT.test(url.pathname)) links.add(url.toString());
    } catch {
      // ignore malformed links
    }
  }
  for (const path of ["/contact", "/about"]) links.add(new URL(path, home).toString());
  const pages = await Promise.all([...links].slice(0, 3).map((url) => pageText(url, fetcher)));
  const found = new Set<string>();
  for (const text of [homeHtml, ...pages]) for (const email of emailsIn(text)) found.add(email);
  return [...found].slice(0, 5);
}
