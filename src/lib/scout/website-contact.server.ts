import { publicResultUrl } from "./audience-search.server";
import {
  emailsIn,
  pageText,
  emailOfAuthor,
  type AuthorContactResult,
} from "./perplexity-contact.server";

const PAGE_HINT =
  /contact|about|connect|reach|press|media|booking|speaking|events?|newsletter|enquir|inquir|privacy|terms|kit/i;

/** Free first pass before any paid search: read the author's own website
 *  (home page plus up to 10 contact/about/press-style pages) and return the emails
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
  for (const path of ["/contact", "/about", "/about-me", "/media", "/press", "/privacy"])
    links.add(new URL(path, home).toString());
  const pages = await Promise.all([...links].slice(0, 10).map((url) => pageText(url, fetcher)));
  const found = new Set<string>();
  for (const text of [homeHtml, ...pages]) for (const email of emailsIn(text)) found.add(email);
  return [...found].slice(0, 5);
}

/** Evidence-aware free pass. Publication and direct-author attribution are
 * separate: a website vendor/privacy address never counts as a direct match. */
export async function websiteContactEvidence(
  input: { website?: string | null; author: string; book: string },
  fetcher = fetch,
): Promise<AuthorContactResult> {
  const home = publicResultUrl(input.website);
  if (!home) return { identity_match: false, summary: "No website", contacts: [], sources: [] };
  const html = await pageText(home, fetcher);
  const links = new Set<string>([home]);
  for (const [, href] of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(href!, home);
      if (url.hostname === new URL(home).hostname && PAGE_HINT.test(url.pathname))
        links.add(url.toString());
    } catch {
      /* malformed link */
    }
  }
  for (const path of ["/contact", "/about", "/media", "/press"])
    links.add(new URL(path, home).toString());
  const urls = [...links].slice(0, 11);
  const pages = await Promise.all(
    urls.map(async (url) => ({ url, text: url === home ? html : await pageText(url, fetcher) })),
  );
  const contacts = new Map<string, AuthorContactResult["contacts"][number]>();
  for (const page of pages) {
    const text = page.text.replace(/<[^>]+>/g, " ");
    for (const email of emailsIn(text)) {
      const at = text.toLowerCase().indexOf(email);
      const evidence =
        at < 0
          ? `Published address ${email}; encoded in source page`
          : text.slice(Math.max(0, at - 200), at + email.length + 200);
      const role = /publicist|publicity/i.test(evidence)
        ? "publicist"
        : /literary agen|representation/i.test(evidence)
          ? "agent"
          : /publisher/i.test(evidence)
            ? "publisher"
            : "author";
      const verified =
        emailOfAuthor(text, email, input.author, input.book) &&
        !/privacy|webmaster|web design|data protection/i.test(evidence);
      const contact = {
        email,
        role,
        source_url: page.url,
        evidence,
        verified,
      } as AuthorContactResult["contacts"][number];
      if (!contacts.has(email) || verified) contacts.set(email, contact);
    }
  }
  return {
    identity_match: contacts.size > 0,
    summary: "Website pages checked",
    contacts: [...contacts.values()].slice(0, 10),
    sources: pages.map((p) => ({ url: p.url })),
  };
}
