import { expect, test } from "bun:test";
import { createTransport, assertSourceUrl, retryDelay } from "../src/lib/scout/transport.server";
import type { asScoutDb, ScoutSource } from "../src/lib/scout/db";
function fixture(responses: Response[], overrides: Partial<ScoutSource> = {}) {
  const source = {
    slug: "google_books",
    enabled: true,
    source_access_status: "allowed",
    crawl_token: "lease",
    crawl_delay_ms: 2000,
    max_pages: 3,
    ...overrides,
  } as ScoutSource;
  const cache = new Map<string, { body: string; expires_at: string }>();
  const db = {
    from(table: string) {
      let url = "";
      let update: Record<string, unknown> | undefined;
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          if (key === "url") url = value;
          return chain;
        },
        single: async () => ({ data: source, error: null }),
        maybeSingle: async () => ({ data: cache.get(url) ?? null, error: null }),
        update: (data: Record<string, unknown>) => {
          update = data;
          return chain;
        },
        upsert: async (data: { url: string; body: string; expires_at: string }) => {
          cache.set(data.url, data);
          return { error: null };
        },
        then: (resolve: (v: unknown) => void) => {
          if (update) Object.assign(source, update);
          resolve({ error: null });
        },
      };
      return chain;
    },
  } as unknown as ReturnType<typeof asScoutDb>;
  const requests: string[] = [],
    delays: number[] = [],
    logs: string[] = [];
  const fetcher = (async (url: URL) => {
    requests.push(url.toString());
    const next = responses.shift();
    if (!next) throw new Error("Unexpected request");
    return next;
  }) as unknown as typeof fetch;
  const transport = createTransport(
    source,
    Date.now() + 90000,
    async (m) => {
      logs.push(m);
    },
    {
      db,
      fetch: fetcher,
      sleep: async (ms) => {
        delays.push(ms);
      },
    },
  );
  return { transport, requests, delays, logs, source };
}
const robots = (body = "User-agent: *\nAllow: /") =>
  new Response(body, { headers: { "content-type": "text/plain" } });
const json = (value: unknown) => Response.json(value);
test("unapproved hosts, credentials, ports and protocols fail closed", () => {
  for (const url of [
    "http://www.googleapis.com/books",
    "https://127.0.0.1",
    "https://www.googleapis.com.evil.test",
    "https://name:pass@www.googleapis.com",
    "https://www.googleapis.com:8443",
  ])
    expect(() => assertSourceUrl(url, ["www.googleapis.com"])).toThrow();
});
test("robots denies before fetching the page", async () => {
  const f = fixture([robots("User-agent: *\nDisallow: /books")]);
  await expect(
    f.transport.fetchJson("https://www.googleapis.com/books/v1/volumes?q=a"),
  ).rejects.toThrow("robots.txt");
  expect(f.requests).toHaveLength(1);
  expect(f.source.robots_status).toBe("disallowed");
});
test("cached JSON is reused after access and robots checks", async () => {
  const f = fixture([robots(), json({ items: [] })]);
  const url = "https://www.googleapis.com/books/v1/volumes?q=a";
  await f.transport.fetchJson(url);
  await f.transport.fetchJson(url);
  expect(f.requests).toHaveLength(2);
  f.source.enabled = false;
  await expect(f.transport.fetchJson(url)).rejects.toThrow("disabled");
});
test("redirects and noindex responses are not followed or cached", async () => {
  for (const response of [
    new Response("", { status: 302, headers: { location: "http://127.0.0.1/private" } }),
    new Response("{}", {
      headers: { "content-type": "application/json", "x-robots-tag": "noindex" },
    }),
  ]) {
    const f = fixture([robots(), response]);
    await expect(
      f.transport.fetchJson("https://www.googleapis.com/books/v1/volumes?q=a"),
    ).rejects.toThrow();
    expect(f.requests).toHaveLength(2);
  }
});
test("429 backs off and repeated blocking stops the source", async () => {
  const f = fixture([
    robots(),
    ...Array.from(
      { length: 3 },
      () => new Response("", { status: 429, headers: { "retry-after": "3" } }),
    ),
  ]);
  await expect(
    f.transport.fetchJson("https://www.googleapis.com/books/v1/volumes?q=a"),
  ).rejects.toThrow("paused");
  expect(f.requests).toHaveLength(4);
  expect(f.delays).toContain(3000);
  expect(f.logs.length).toBeGreaterThanOrEqual(3);
  expect(retryDelay("120", 0)).toBe(120000);
});
test("missing robots access and HTML challenges prevent page requests", async () => {
  const f = fixture([new Response("<html>challenge</html>")]);
  await expect(
    f.transport.fetchJson("https://www.googleapis.com/books/v1/volumes?q=a"),
  ).rejects.toThrow("challenge");
  expect(f.requests).toHaveLength(1);
});
