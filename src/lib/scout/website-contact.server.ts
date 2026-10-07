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
  // Style blocks hold font credits and vendor addresses, not contacts.
  const visible = (html: string) =>
    html.replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  // The site must be this author's: full name on it, plus the book or writing.
  const site = pages
    .map((p) => visible(p.text))
    .join(" ")
    .toLowerCase();
  const names = input.author.toLowerCase().split(/\s+/);
  const titleWords = input.book
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !["with", "from", "that", "this", "your", "book"].includes(w));
  const ownSite =
    site.includes(names.at(-1)!) &&
    (titleWords.some((w) => site.includes(w)) || /\b(author|novels?|writer)\b/.test(site));
  for (const page of ownSite ? pages : []) {
    const text = visible(page.text);
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
        ownSite &&
        emailOfAuthor(text, email, input.author, input.book) &&
        // A privacy-page address counts only when it carries the author's name.
        (!/privacy|webmaster|web design|data protection/i.test(evidence) ||
          email
            .split("@")[0]!
            .replace(/[^a-z]/g, "")
            .includes(names.at(-1)!.replace(/[^a-z]/g, "")) ||
          email.split("@")[0]!.startsWith(names[0]!.replace(/[^a-z]/g, "")));
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

/** Likely personal domains for an author ("Timothy R Baldwin" ->
 *  timothyrbaldwin.com, timothybaldwinauthor.com, ...). */
export function guessAuthorSites(author: string) {
  const parts = author
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|phd|md)\b\.?/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (parts.length < 2) return [];
  const bases = [...new Set([parts.join(""), `${parts[0]}${parts.at(-1)}`])];
  return bases.flatMap((base) =>
    ["", "author", "books", "writer"].map((suffix) => `https://${base}${suffix}.com`),
  );
}

/** Free pass: the saved website, or else guessed personal domains whose home
 *  page names the author. Stops at the first site with a verified author email. */
export async function freeContactEvidence(
  input: { website?: string | null; author: string; book: string },
  fetcher = fetch,
): Promise<AuthorContactResult> {
  if (publicResultUrl(input.website)) return websiteContactEvidence(input, fetcher);
  const surname = input.author.trim().split(/\s+/).pop()!.toLowerCase();
  const sites = guessAuthorSites(input.author);
  const homes = await Promise.all(sites.map((url) => pageText(url, fetcher)));
  const live = sites.filter((_, i) => homes[i]!.toLowerCase().includes(surname)).slice(0, 3);
  const empty: AuthorContactResult = {
    identity_match: false,
    summary: "No website found",
    contacts: [],
    sources: [],
  };
  let best = empty;
  for (const website of live) {
    const result = await websiteContactEvidence({ ...input, website }, fetcher);
    if (result.contacts.some((c) => c.role === "author" && c.verified)) return result;
    if (result.contacts.length > best.contacts.length) best = result;
  }
  return best;
}
