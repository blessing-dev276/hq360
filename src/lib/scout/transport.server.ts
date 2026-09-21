import { load } from "cheerio";
import robotsParser from "robots-parser";
import { asScoutDb, type ScoutSource } from "./db";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
export class AccessError extends Error {
  constructor(
    message: string,
    public status: "blocked" | "limited" = "blocked",
  ) {
    super(message);
  }
}
export const SOURCE_HOSTS: Record<string, string[]> = {
  reedsy_discovery: ["reedsy.com"],
  google_books: ["www.googleapis.com"],
  open_library: ["openlibrary.org"],
};
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export function assertSourceUrl(raw: string, hosts: string[]) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !hosts.includes(url.hostname)
  )
    throw new AccessError("URL outside approved source hosts");
  return url;
}
export function retryDelay(value: string | null, attempt: number) {
  const requested = value
    ? /^\d+$/.test(value)
      ? Number(value) * 1000
      : Date.parse(value) - Date.now()
    : 0;
  return Math.max(2000 * 2 ** attempt, Number.isFinite(requested) ? requested : 0);
}
/** Only reachable through a DB-leased run. Redirects are never followed. */
export function createTransport(
  source: ScoutSource,
  deadline: number,
  log: (message: string, url: string) => Promise<void>,
  dependencies: {
    db?: ReturnType<typeof asScoutDb>;
    fetch?: typeof fetch;
    sleep?: typeof sleep;
  } = {},
) {
  const db = dependencies.db ?? asScoutDb(supabaseAdmin);
  const requestFetch = dependencies.fetch ?? fetch;
  const pause = dependencies.sleep ?? sleep;
  const hosts = SOURCE_HOSTS[source.slug] ?? [];
  let lastRequest = source.last_synced_at ? Date.parse(source.last_synced_at) : 0;
  let delay = source.crawl_delay_ms;
  const robots = new Map<string, ReturnType<typeof robotsParser>>();
  let pages = 0;
  async function checkActive() {
    if (Date.now() >= deadline) throw new Error("Crawl time budget reached; resume on next run");
    const { data, error } = await db
      .from("scout_sources")
      .select("enabled,source_access_status,crawl_token")
      .eq("slug", source.slug)
      .single();
    if (
      error ||
      !data?.enabled ||
      !["allowed", "limited"].includes(data.source_access_status) ||
      data.crawl_token !== source.crawl_token
    )
      throw new AccessError("Source disabled, restricted or lease lost");
  }
  async function request(url: URL, isRobots = false, html = false): Promise<string> {
    await checkActive();
    const cacheKey = new URL(url);
    cacheKey.searchParams.delete("key");
    const { data: cached, error: cacheError } = await db
      .from("scout_page_cache")
      .select("body,expires_at")
      .eq("url", cacheKey.toString())
      .maybeSingle();
    if (cacheError) throw cacheError;
    if (cached && Date.parse(cached.expires_at) > Date.now()) return cached.body;
    for (let attempt = 0; attempt < 3; attempt++) {
      const wait = Math.max(0, lastRequest + delay + Math.random() * 500 - Date.now());
      if (Date.now() + wait + 15000 > deadline) throw new Error("Crawl time budget reached");
      await pause(wait);
      await checkActive();
      lastRequest = Date.now();
      const response = await requestFetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: {
          "user-agent": `HQ360Scout/1.0${process.env.SCOUT_CONTACT_EMAIL ? ` (${process.env.SCOUT_CONTACT_EMAIL})` : ""}`,
          accept: isRobots ? "text/plain" : html ? "text/html" : "application/json",
        },
      });
      if (response.status === 404 && isRobots) return "";
      if ([401, 403].includes(response.status) || (response.status >= 300 && response.status < 400))
        throw new AccessError(`Public access restricted (HTTP ${response.status})`);
      if (response.status === 429 || response.status >= 500) {
        await log(`HTTP ${response.status}; attempt ${attempt + 1}`, cacheKey.toString());
        const backoff = retryDelay(response.headers.get("retry-after"), attempt);
        await response.body?.cancel();
        if (attempt === 2 || Date.now() + backoff + 15000 > deadline)
          throw new AccessError(
            `Source paused after HTTP ${response.status}`,
            response.status === 429 ? "blocked" : "limited",
          );
        await pause(backoff);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (/noindex|none/i.test(response.headers.get("x-robots-tag") ?? ""))
        throw new AccessError("X-Robots-Tag excludes collection");
      if (Number(response.headers.get("content-length") ?? 0) > 2_000_000)
        throw new Error("Response too large");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty response");
      const decoder = new TextDecoder();
      let body = "",
        bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > 2_000_000) {
          await reader.cancel();
          throw new Error("Response too large");
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
      if (
        !isRobots && !html &&
        !/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get("content-type") ?? "")
      )
        throw new AccessError("Unexpected non-JSON response; possible access challenge");
      if (isRobots && /<html|<!doctype/i.test(body))
        throw new AccessError("Robots response is an access challenge");
      if(html) {
        if(!/text\/html/i.test(response.headers.get("content-type")??"")) throw new AccessError("Expected a public HTML page");
        const $=load(body);
        if(/\b(noindex|none)\b/i.test($('meta[name="robots"],meta[name="HQ360Scout"]').map((_,e)=>$(e).attr('content')??'').get().join(','))) throw new AccessError("Page excludes collection");
        if(/just a moment|access denied|verify you are human|captcha/i.test($('title').text())) throw new AccessError("Public page requires an access challenge");
        // No scripts are executed and no anonymous form tokens are retained in cache.
        $('form,script:not([type="application/ld+json"]),style,d-app-config').remove();
        body=$.html();
      }
      const { error } = await db.from("scout_page_cache").upsert({
        url: cacheKey.toString(),
        body,
        expires_at: new Date(Date.now() + (isRobots ? 3600000 : 86400000)).toISOString(),
        fetched_at: new Date().toISOString(),
      });
      if (error) throw error;
      return body;
    }
    throw new Error("Retries exhausted");
  }
  async function fetchPage(raw: string, html: boolean): Promise<string> {
      const url = assertSourceUrl(raw, hosts);
      if (!robots.has(url.origin)) {
        const robotUrl = new URL("/robots.txt", url);
        let body: string;
        try {
          body = await request(robotUrl, true);
        } catch (error) {
          await db
            .from("scout_sources")
            .update({ robots_status: "unavailable" })
            .eq("slug", source.slug);
          throw error;
        }
        const parser = robotsParser(robotUrl.toString(), body);
        robots.set(url.origin, parser);
        delay = Math.max(delay, (parser.getCrawlDelay("HQ360Scout") ?? 0) * 1000);
      }
      const allowed = robots.get(url.origin)!.isAllowed(url.toString(), "HQ360Scout");
      const { error } = await db
        .from("scout_sources")
        .update({ robots_status: allowed === false ? "disallowed" : "allowed" })
        .eq("slug", source.slug);
      if (error) throw error;
      if (allowed === false) throw new AccessError("robots.txt disallows this URL");
      if (pages >= source.max_pages) throw new Error("Page limit reached");
      pages++;
      try {
        return await request(url, false, html);
      } catch (error) {
        await log(
          error instanceof Error ? error.message : "Request failed",
          url.origin + url.pathname,
        );
        throw error;
      }
  }
  return {get pages(){return pages;}, fetchPage:(raw:string)=>fetchPage(raw,true), fetchJson:async(raw:string):Promise<unknown>=>JSON.parse(await fetchPage(raw,false))};
}
