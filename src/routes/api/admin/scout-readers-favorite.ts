import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import robotsParser from "robots-parser";
import { resolveScoutAccess } from "@/lib/scout/owner.server";
import { generatedAuthorNames } from "@/lib/scout/history.server";
import { normalizedName } from "@/lib/scout/db";
import {
  RF_DEFAULT,
  RF_ORIGIN,
  readersFavoriteCatalog,
  parseReadersFavorite,
} from "@/lib/scout/readers-favorite";
const schema = z.object({
  metadataOnly: z.boolean().default(false),
  catalog: z.string().max(300).default(RF_DEFAULT),
  page: z.number().int().min(1).max(100).default(1),
});
const cache = new Map<string, { until: number; body: ReturnType<typeof parseReadersFavorite> }>();
let pending = false;
let lastRequest = 0;
async function publicPage(url: string) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "HQ360-Scout/1.0 (+https://www.hq360.space)",
      Accept: "text/html,text/plain",
    },
  });
  if (!response.ok)
    throw new Error(`Readers’ Favorite is unavailable (${response.status}). Please try later.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty source response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) throw new Error("Source page is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export const Route = createFileRoute("/api/admin/scout-readers-favorite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return Response.json({ error: "unauthorized" }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: "Invalid search options." }, { status: 400 });
        const metadataOnly = parsed.data.metadataOnly;
        let url: string;
        try {
          url = readersFavoriteCatalog(parsed.data.catalog, parsed.data.page);
          if (metadataOnly) {
            // Readers’ Favorite clamps out-of-range requests to its final page.
            // One page supplies the active page number and exact remainder.
            const lastPage = new URL(url);
            lastPage.searchParams.set("page", "1000000");
            url = lastPage.href;
          }
        } catch {
          return Response.json({ error: "Use a Readers’ Favorite genre URL." }, { status: 400 });
        }
        async function freshResults(body: ReturnType<typeof parseReadersFavorite>) {
          if (metadataOnly) return { ...body, items: [] };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const seen = await generatedAuthorNames(supabaseAdmin, access!.owner);
          return {
            ...body,
            items: body.items.filter((item) => {
              const key = normalizedName(item.authorName ?? "");
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            }),
          };
        }
        const cached = cache.get(url);
        if (cached && cached.until > Date.now()) {
          try {
            return Response.json(await freshResults(cached.body));
          } catch {
            return Response.json({ error: "Could not check author history." }, { status: 503 });
          }
        }
        if (pending || Date.now() - lastRequest < 2000)
          return Response.json(
            { error: "Please wait a moment before another search." },
            { status: 429, headers: { "Retry-After": "2" } },
          );
        pending = true;
        lastRequest = Date.now();
        try {
          const robotsUrl = `${RF_ORIGIN}/robots.txt`;
          const robots = robotsParser(robotsUrl, await publicPage(robotsUrl));
          if (robots.isAllowed(url, "HQ360-Scout") === false)
            throw new Error("This source currently disallows automated catalog access.");
          const body = parseReadersFavorite(await publicPage(url), url);
          if (cache.size >= 100) cache.delete(cache.keys().next().value!);
          cache.set(url, {
            until: Date.now() + (metadataOnly ? 1800000 : 300000),
            body,
          });
          return Response.json(await freshResults(body));
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Source unavailable." },
            { status: 503 },
          );
        } finally {
          pending = false;
        }
      },
    },
  },
});
