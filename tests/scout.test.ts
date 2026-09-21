import { describe, expect, test } from "bun:test";
import {
  canonicalUrl,
  normalizeBook,
  compareIdentity,
  titleSimilarity,
} from "../src/lib/scout/normalize";
import { parsePublicBook, discoverPublicLinks } from "../src/lib/scout/sources/public-pages/parse";
import { googleBooksAdapter } from "../src/lib/scout/adapters/google-books";
import { openLibraryAdapter } from "../src/lib/scout/adapters/open-library";
import robotsParser from "robots-parser";
describe("Scout identity and normalization", () => {
  test("name alone never merges; strong evidence still requires review", () => {
    expect(compareIdentity({ name: "A Writer" }, { name: "A Writer" })).toMatchObject({
      score: 10,
      autoMerge: false,
    });
    expect(
      compareIdentity(
        { name: "A Writer", website: "https://writer.test", books: ["123"] },
        { name: "A Writer", website: "https://writer.test/", books: ["123"] },
      ),
    ).toMatchObject({ score: 90, autoMerge: false });
  });
  test("canonical URLs retain identifiers and remove tracking", () => {
    expect(canonicalUrl("https://books.google.com/books?utm_source=x&id=123#x")).toBe(
      "https://books.google.com/books?id=123",
    );
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
  });
  test("dates preserve precision and invalid dates are not fabricated", () => {
    const base = {
      authorName: "A",
      title: "B",
      sourceUrl: "https://example.com/book",
      rawData: {},
    };
    expect(normalizeBook("test", { ...base, publicationDate: "2025-02" })).toMatchObject({
      publication_date: null,
      publication_year: 2025,
    });
    expect(
      normalizeBook("test", { ...base, publicationDate: "2025-02-30" }).publication_date,
    ).toBeNull();
    expect(() => normalizeBook("test", { ...base, sourceUrl: undefined })).toThrow();
    expect(titleSimilarity("A Book: a story", "A Book a story")).toBe(1);
  });
});
describe("source parsing", () => {
  test("JSON-LD graph and reference identity are preferred over metadata", () => {
    const record = parsePublicBook(
      `<meta property="og:title" content="Wrong"><script type="application/ld+json">{"@graph":[{"@type":"Book","name":"The Book","author":{"@id":"#person"}},{"@id":"#person","@type":"Person","name":"Author"}]}</script>`,
      "https://example.com/book",
    );
    expect(record).toMatchObject({
      title: "The Book",
      authorName: "Author",
      sourceUrl: "https://example.com/book",
    });
  });
  test("robots exclusions and missing identities prevent collection", () => {
    expect(() =>
      parsePublicBook('<meta name="robots" content="noindex">', "https://example.com"),
    ).toThrow();
    expect(
      parsePublicBook('<meta property="og:title" content="Store">', "https://example.com"),
    ).toBeNull();
    expect(
      discoverPublicLinks(
        '<a href="/book">Book</a><a href="https://evil.test/book">Bad</a>',
        "https://example.com",
        () => true,
      ),
    ).toEqual(["https://example.com/book"]);
  });
  test("robots most specific group, allow precedence and wildcard paths", () => {
    const robot = robotsParser(
      "https://example.com/robots.txt",
      "User-agent: *\nDisallow: /\n\nUser-agent: HQ360Scout\nDisallow: /private*\nAllow: /private/public$\nCrawl-delay: 5",
    );
    expect(robot.isAllowed("https://example.com/books", "HQ360Scout")).toBe(true);
    expect(robot.isAllowed("https://example.com/private/a", "HQ360Scout")).toBe(false);
    expect(robot.isAllowed("https://example.com/private/public", "HQ360Scout")).toBe(true);
    expect(robot.getCrawlDelay("HQ360Scout")).toBe(5);
  });
  test("Google Books maps metadata and passes pagination through the shared fetcher", async () => {
    let requested = "";
    const result = await googleBooksAdapter.discover({
      query: "book",
      offset: 40,
      fetchJson: async (url) => {
        requested = url;
        return {
          items: [
            {
              id: "x",
              volumeInfo: {
                title: "B",
                authors: ["A"],
                subtitle: "S",
                description: "D",
                imageLinks: { thumbnail: "https://example.com/cover" },
                ratingsCount: 3,
              },
            },
          ],
        };
      },
    });
    expect(requested).toContain("startIndex=40");
    expect(result[0]).toMatchObject({
      title: "B",
      subtitle: "S",
      description: "D",
      reviewSignal: { platform: "google_books", reviewCount: 3 },
    });
  });
  test("Open Library preserves subject author identity and excludes disallowed search", async () => {
    let url = "";
    const result = await openLibraryAdapter.discover({
      query: "",
      genre: "fiction",
      fetchJson: async (requested) => {
        url = requested;
        return {
          works: [
            {
              key: "/works/OL1W",
              title: "B",
              authors: [{ name: "A", key: "/authors/OL1A" }],
              first_publish_year: 2020,
            },
          ],
        };
      },
    });
    expect(url).toContain("/subjects/fiction.json");
    expect(result[0]).toMatchObject({
      authorProfileUrl: "https://openlibrary.org/authors/OL1A",
      publicationDate: "2020",
    });
    await expect(
      openLibraryAdapter.discover({
        query: "book",
        fetchJson: async () => {
          throw new Error("Must not fetch");
        },
      }),
    ).rejects.toThrow("requires a genre");
    await expect(
      openLibraryAdapter.discover({
        query: "",
        genre: "fiction",
        fetchJson: async () => {
          throw new Error("blocked");
        },
      }),
    ).rejects.toThrow("blocked");
  });
});
