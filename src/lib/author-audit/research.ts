export type VerificationStatus = "verified" | "likely" | "unverified" | "conflicting";

export type ResearchSource = {
  provider: "google_books" | "open_library" | "website" | "amazon_manual";
  sourceType: string;
  url?: string;
  status: "retrieved" | "unavailable" | "manual_verification_required" | "failed";
  retrievedAt: string;
  data: Record<string, unknown>;
  error?: string;
};

export type ResearchEvidence = {
  section: string;
  claim: string;
  excerpt?: string;
  url?: string;
  verificationStatus: VerificationStatus;
  confidence: "high" | "medium" | "low";
};

export function extractAsin(value: string): string | undefined {
  const input = value.trim().toUpperCase();
  const direct = input.match(/^[A-Z0-9]{10}$/)?.[0];
  if (direct) return direct;
  return input.match(/(?:DP|ASIN)[/=]([A-Z0-9]{10})(?:[/?&#]|$)/)?.[1];
}

export function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function titleMatches(expected: string, received?: string) {
  if (!received) return false;
  const left = normalized(expected);
  const right = normalized(received);
  return left === right || left.includes(right) || right.includes(left);
}

/** Many real book titles are "Main Title: A Descriptive Subtitle" — catalog
 * search APIs frequently only index the main title, so a query built from
 * the full title-plus-subtitle can miss a record that genuinely exists.
 * Returns the portion before the first subtitle separator, or undefined if
 * there isn't one. */
function primaryTitle(title: string): string | undefined {
  const cut = title.search(/[:—–]/);
  if (cut <= 0) return undefined;
  const trimmed = title.slice(0, cut).trim();
  return trimmed && trimmed !== title ? trimmed : undefined;
}

async function readJson(url: string, retryOn429 = false): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HQ360AuthorAudit/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 429 && retryOn429) {
    await new Promise((r) => setTimeout(r, 1_500));
    return readJson(url, false);
  }
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function queryGoogleBooks(title: string, author: string) {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const query = encodeURIComponent(`intitle:${title}+inauthor:${author}`);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5${apiKey ? `&key=${apiKey}` : ""}`;
  const data = (await readJson(url, /* retryOn429 */ !apiKey)) as {
    items?: { volumeInfo?: Record<string, unknown>; id?: string }[];
  };
  return data.items?.find((candidate) =>
    titleMatches(title, String(candidate.volumeInfo?.title ?? "")),
  );
}

export async function searchGoogleBooks(input: {
  title: string;
  author: string;
}): Promise<ResearchSource> {
  const retrievedAt = new Date().toISOString();
  try {
    let item = await queryGoogleBooks(input.title, input.author);
    const shortTitle = primaryTitle(input.title);
    if (!item && shortTitle) item = await queryGoogleBooks(shortTitle, input.author);
    if (!item?.volumeInfo) {
      return {
        provider: "google_books",
        sourceType: "book_metadata",
        status: "unavailable",
        retrievedAt,
        data: {},
      };
    }
    return {
      provider: "google_books",
      sourceType: "book_metadata",
      ...(item.id ? { url: `https://books.google.com/books?id=${item.id}` } : {}),
      status: "retrieved",
      retrievedAt,
      data: item.volumeInfo,
    };
  } catch (error) {
    return {
      provider: "google_books",
      sourceType: "book_metadata",
      status: "failed",
      retrievedAt,
      data: {},
      error: error instanceof Error ? error.message : "Unknown provider error",
    };
  }
}

async function queryOpenLibrary(title: string, author: string) {
  const query = new URLSearchParams({ title, author, limit: "5" });
  const data = (await readJson(`https://openlibrary.org/search.json?${query}`)) as {
    docs?: Record<string, unknown>[];
  };
  return data.docs?.find((candidate) => titleMatches(title, String(candidate.title ?? "")));
}

export async function searchOpenLibrary(input: {
  title: string;
  author: string;
}): Promise<ResearchSource> {
  const retrievedAt = new Date().toISOString();
  try {
    let item = await queryOpenLibrary(input.title, input.author);
    const shortTitle = primaryTitle(input.title);
    if (!item && shortTitle) item = await queryOpenLibrary(shortTitle, input.author);
    if (!item)
      return {
        provider: "open_library",
        sourceType: "book_metadata",
        status: "unavailable",
        retrievedAt,
        data: {},
      };
    return {
      provider: "open_library",
      sourceType: "book_metadata",
      ...(typeof item.key === "string" ? { url: `https://openlibrary.org${item.key}` } : {}),
      status: "retrieved",
      retrievedAt,
      data: item,
    };
  } catch (error) {
    return {
      provider: "open_library",
      sourceType: "book_metadata",
      status: "failed",
      retrievedAt,
      data: {},
      error: error instanceof Error ? error.message : "Unknown provider error",
    };
  }
}

function permittedWebsiteUrl(value?: string) {
  if (!value) return undefined;
  // A visitor typing a website into a plain text field very often leaves
  // off the scheme ("donnamaltz.com" rather than "https://donnamaltz.com")
  // -- new URL() throws on that, which silently made a real, valid website
  // read as "not supplied". Assume https for a bare domain/path.
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

export async function auditWebsite(website?: string): Promise<ResearchSource> {
  const retrievedAt = new Date().toISOString();
  const url = permittedWebsiteUrl(website);
  if (!url)
    return {
      provider: "website",
      sourceType: "website_basics",
      status: "unavailable",
      retrievedAt,
      data: {},
      error: "No permitted website URL supplied",
    };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "HQ360AuthorAudit/1.0" },
    });
    const html = await response.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const description = html
      .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]
      ?.trim();
    const newsletterVisible = /newsletter|subscribe|join (the )?(mailing |email )?list/i.test(html);
    return {
      provider: "website",
      sourceType: "website_basics",
      url: response.url,
      status: "retrieved",
      retrievedAt,
      data: {
        https: response.url.startsWith("https://"),
        statusCode: response.status,
        title,
        metaDescription: description,
        newsletterVisible,
        htmlLength: html.length,
      },
    };
  } catch (error) {
    return {
      provider: "website",
      sourceType: "website_basics",
      url: url.toString(),
      status: "failed",
      retrievedAt,
      data: {},
      error: error instanceof Error ? error.message : "Website request failed",
    };
  }
}

export function amazonManualVerification(amazonUrlOrAsin?: string): ResearchSource {
  return {
    provider: "amazon_manual",
    sourceType: "amazon_listing",
    ...(amazonUrlOrAsin?.startsWith("http") ? { url: amazonUrlOrAsin } : {}),
    status: "manual_verification_required",
    retrievedAt: new Date().toISOString(),
    data: {
      asin: extractAsin(amazonUrlOrAsin ?? ""),
      fields: [
        "title",
        "price",
        "rating",
        "review_count",
        "categories",
        "a_plus_content",
        "description",
      ],
    },
  };
}

export async function runFreeResearch(input: {
  author: string;
  title: string;
  website?: string;
  amazonUrlOrAsin?: string;
}) {
  const sources = await Promise.all([
    searchGoogleBooks(input),
    searchOpenLibrary(input),
    auditWebsite(input.website),
  ]);
  sources.push(amazonManualVerification(input.amazonUrlOrAsin));
  return sources;
}
