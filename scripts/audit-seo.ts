/** Read-only HTTP audit. Run against a dev server, preview or deployed site. */
import assert from "node:assert/strict";

const base = (process.argv[2] || "http://localhost:8080").replace(/\/$/, "");
const origin = "https://www.hq360.space";
const fetchPage = (path: string) =>
  fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000) });
const sitemap = await fetchPage("/sitemap.xml");
assert.equal(sitemap.status, 200, "Sitemap must return 200");
assert.match(sitemap.headers.get("content-type") || "", /xml/);
const locations = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]!);
assert(locations.length > 0, "Sitemap is empty");
assert.equal(new Set(locations).size, locations.length, "Duplicate sitemap URLs");
const robots = await (await fetchPage("/robots.txt")).text();
assert.match(robots, /User-agent: OAI-SearchBot\s+Allow: \//i);
assert.match(robots, /User-agent: \*\s+Allow: \//i);
assert(!/^User-agent: GPTBot/im.test(robots), "Preserve GPTBot's existing wildcard inheritance");
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`));

const pages = new Map<string, { ids: Set<string>; links: string[] }>();
const titles = new Set<string>();
const descriptions = new Set<string>();
async function inspect(path: string, indexable = true) {
  const response = await fetchPage(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  let h1 = 0,
    title = "",
    text = "";
  const canonicals: string[] = [],
    metas: { name: string; content: string }[] = [];
  const links: string[] = [],
    ids = new Set<string>();
  await new HTMLRewriter()
    .on("h1", {
      element() {
        h1++;
      },
    })
    .on("title", {
      text(chunk) {
        title += chunk.text;
      },
    })
    .on("main", {
      text(chunk) {
        text += chunk.text;
      },
    })
    .on("link[rel=canonical]", {
      element(el) {
        canonicals.push(el.getAttribute("href")!);
      },
    })
    .on("meta[name]", {
      element(el) {
        metas.push({ name: el.getAttribute("name")!, content: el.getAttribute("content") || "" });
      },
    })
    .on("a[href]", {
      element(el) {
        links.push(el.getAttribute("href")!);
      },
    })
    .on("[id]", {
      element(el) {
        ids.add(el.getAttribute("id")!);
      },
    })
    .transform(new Response(html))
    .text();
  assert.equal(h1, 1, `${path}: expected one H1`);
  assert.deepEqual(canonicals, [origin + path], `${path}: canonical`);
  if (indexable) {
    assert(!response.headers.get("x-robots-tag")?.includes("noindex"), path);
    assert(!metas.some((m) => m.name === "robots" && m.content.includes("noindex")), path);
    assert(title && !titles.has(title), `${path}: missing/duplicate title`);
    const description = metas.find((m) => m.name === "description")?.content;
    assert(description && !descriptions.has(description), `${path}: missing/duplicate description`);
    titles.add(title);
    descriptions.add(description);
  } else {
    assert(
      metas.some((m) => m.name === "robots" && m.content.includes("noindex")),
      `${path}: sample must be noindex`,
    );
  }
  // HTMLRewriter text chunks preserve entities; compare decoded human-readable text.
  text = text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (entity.startsWith("#"))
      return String.fromCodePoint(
        parseInt(
          entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1),
          entity[1]?.toLowerCase() === "x" ? 16 : 10,
        ),
      );
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[
      entity.toLowerCase()
    ]!;
  });
  for (const match of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    const schema = JSON.parse(match[1]!);
    if (schema["@type"] === "FAQPage")
      for (const question of schema.mainEntity) {
        assert(text.includes(question.acceptedAnswer.text), `${path}: FAQ answer missing from SSR`);
      }
  }
  pages.set(path, { ids, links });
}
for (const location of locations) {
  assert(location.startsWith(origin + "/"), location);
  const path = new URL(location).pathname;
  assert(!/^\/(api|admin|services|blog)(\/|$)/.test(path), `Noncanonical sitemap entry: ${path}`);
  await inspect(path);
}
const api = await fetchPage("/api/public/case-studies");
assert.equal(api.status, 200);
for (const study of (await api.json()).items) {
  const path = `/work/${study.slug}`;
  if (study.status === "sample") {
    assert(!locations.includes(origin + path), `Sample in sitemap: ${path}`);
    await inspect(path, false);
  } else assert(locations.includes(origin + path), `Published project missing: ${path}`);
}
let checkedLinks = 0;
for (const [path, page] of pages)
  for (const href of page.links) {
    const url = new URL(href, origin + path);
    if (url.origin !== origin) continue;
    const destination = pages.get(url.pathname);
    if (!destination) {
      const response = await fetchPage(url.pathname);
      assert(response.status < 400, `Broken link: ${path} → ${href} (${response.status})`);
    }
    if (url.hash && destination)
      assert(destination.ids.has(decodeURIComponent(url.hash.slice(1))), `Broken anchor: ${href}`);
    checkedLinks++;
  }
for (const path of [
  "/does-not-exist",
  "/work/does-not-exist",
  "/capabilities/does-not-exist",
  "/insights/does-not-exist",
  "/services/does-not-exist",
]) {
  const response = await fetchPage(path);
  assert.equal(response.status, 404, `${path}: must not be a soft 404`);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/, path);
}
for (const [from, to] of [
  ["/services", "/capabilities"],
  ["/services/brand-creative", "/capabilities/brand-creative"],
  ["/blog", "/insights"],
  ["/reviews", "/work"],
]) {
  const response = await fetch(base + from, { redirect: "manual" });
  assert.equal(response.status, 301, from);
  assert.equal(new URL(response.headers.get("location")!, base).pathname, to);
}
console.log(
  `PASS: ${locations.length} indexable pages, ${pages.size - locations.length} sample pages, ${checkedLinks} internal links; SSR FAQs, JSON-LD, robots, canonicals, metadata, 404s and redirects.`,
);
