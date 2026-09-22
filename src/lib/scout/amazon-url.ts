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
    !/^(www\.)?amazon\.(com|ca|de|co\.uk|com\.au)$/.test(url.hostname)
  ) {
    throw new Error("Use a product link from Amazon US, Canada, Germany, UK or Australia.");
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
