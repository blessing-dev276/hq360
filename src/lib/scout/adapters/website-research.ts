/**
 * Single-URL research: given one author's own website (already known --
 * either entered by staff or already on their scout_authors row), fetch
 * that one page and pull out publicly visible bio/contact signals. This is
 * the same "point it at one page and read it" pattern the existing
 * author-audit tool uses (see src/lib/author-audit/research.ts#auditWebsite)
 * -- not a crawler and not applicable to third-party directories.
 */

export type WebsiteResearchResult = {
  url: string;
  status: "retrieved" | "unavailable" | "failed";
  retrievedAt: string;
  title?: string | undefined;
  metaDescription?: string | undefined;
  contactEmail?: string | undefined;
  contactFormUrl?: string | undefined;
  newsletterVisible?: boolean | undefined;
  error?: string | undefined;
};

function permittedUrl(value: string): URL | undefined {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(hostname)
    )
      return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export async function researchAuthorWebsite(rawUrl: string): Promise<WebsiteResearchResult> {
  const retrievedAt = new Date().toISOString();
  const url = permittedUrl(rawUrl);
  if (!url)
    return {
      url: rawUrl,
      status: "unavailable",
      retrievedAt,
      error: "Not a permitted website URL",
    };

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": "HQ360Scout/1.0 (+author research)" },
    });
    if (!response.ok)
      return {
        url: response.url,
        status: "failed",
        retrievedAt,
        error: `Site returned ${response.status}`,
      };
    const html = await response.text();

    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const metaDescription = html
      .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]
      ?.trim();

    // mailto: links are an author explicitly publishing their own contact
    // address; a bare regex match of any string that looks like an email
    // is not used, to avoid picking up unrelated addresses on the page.
    const mailto = html.match(/href=["']mailto:([^"'?]+)/i)?.[1]?.trim();

    const contactLink = html.match(/<a[^>]+href=["']([^"']*contact[^"']*)["'][^>]*>/i)?.[1];
    const contactFormUrl = contactLink ? new URL(contactLink, response.url).toString() : undefined;

    const newsletterVisible = /newsletter|subscribe|join (the )?(mailing |email )?list/i.test(html);

    return {
      url: response.url,
      status: "retrieved",
      retrievedAt,
      title,
      metaDescription,
      contactEmail: mailto,
      contactFormUrl,
      newsletterVisible,
    };
  } catch (error) {
    return {
      url: url.toString(),
      status: "failed",
      retrievedAt,
      error: error instanceof Error ? error.message : "Website request failed",
    };
  }
}
