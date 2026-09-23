// Every Amazon marketplace Scout can search or ingest from. Keep this the
// single source of truth -- a domain missing here fails ingestion for any
// book found in that market, even though the search itself succeeded.
export const AMAZON_DOMAINS = [
  "amazon.com",
  "amazon.ca",
  "amazon.com.mx",
  "amazon.com.br",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.com.au",
  "amazon.co.jp",
  "amazon.in",
  "amazon.sg",
  "amazon.ae",
] as const;

const DOMAIN_PATTERN = new RegExp(
  `^(www\\.)?(${AMAZON_DOMAINS.map((domain) => domain.replaceAll(".", "\\.")).join("|")})$`,
);

export function amazonProduct(value: string): { url: string; asin: string } {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter the Amazon book's full product URL.");
  }
  if (/(^|\.)google\.[a-z.]+$/.test(url.hostname)) {
    throw new Error(
      "This is a Google search link. Open a book in those results, then copy its Amazon product URL here. Search results are not imported automatically.",
    );
  }
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !DOMAIN_PATTERN.test(url.hostname)
  ) {
    throw new Error("Use a product link from a supported Amazon marketplace.");
  }
  const asin = url.pathname
    .match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i)?.[1]
    ?.toUpperCase();
  if (!asin)
    throw new Error(
      "Open the book's Amazon product page and copy the link containing /dp/ or /gp/product/.",
    );
  return { asin, url: `https://www.${url.hostname.replace(/^www\./, "")}/dp/${asin}` };
}
