import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const COUNT_BATCH_SIZE = 10;

type ReedsyGenreNode = {
  id: number;
  name: string;
  emoji?: string;
  is_label?: boolean;
  genres?: ReedsyGenreNode[];
};

type FlatGenre = { id: number; name: string; emoji: string; depth: number; bookCount: number };

let cache: { at: number; genres: FlatGenre[] } | null = null;

function flatten(nodes: ReedsyGenreNode[], depth: number): Omit<FlatGenre, "bookCount">[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, emoji: node.emoji ?? "", depth },
    ...flatten(node.genres ?? [], depth + 1),
  ]);
}

async function fetchBookCount(genreId: number, signal: AbortSignal): Promise<number> {
  const url = new URL("https://reedsy.com/discovery/api/books");
  url.searchParams.set("query[genre_id]", String(genreId));
  const response = await fetch(url, {
    signal,
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!response.ok) return 0;
  const data = (await response.json()) as { meta?: { total_count?: number } };
  return data.meta?.total_count ?? 0;
}

export const Route = createFileRoute("/api/admin/scout-reedsy-genres")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);

        if (cache && Date.now() - cache.at < CACHE_TTL_MS)
          return json({ ok: true, genres: cache.genres, cached: true });

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20_000);
          const response = await fetch("https://reedsy.com/discovery/api/genres", {
            signal: controller.signal,
            headers: { "user-agent": USER_AGENT, accept: "application/json" },
          }).finally(() => clearTimeout(timeout));
          if (!response.ok) throw new Error(`Reedsy genres failed (${response.status})`);
          const data = (await response.json()) as { genres?: ReedsyGenreNode[] };
          const flat = flatten(data.genres ?? [], 0);

          const genres: FlatGenre[] = [];
          for (let i = 0; i < flat.length; i += COUNT_BATCH_SIZE) {
            const batch = flat.slice(i, i + COUNT_BATCH_SIZE);
            const counts = await Promise.all(
              batch.map((node) =>
                fetchBookCount(node.id, AbortSignal.timeout(15_000)).catch(() => 0),
              ),
            );
            batch.forEach((node, index) => genres.push({ ...node, bookCount: counts[index]! }));
          }

          cache = { at: Date.now(), genres };
          return json({ ok: true, genres, cached: false });
        } catch (error) {
          console.error("[admin/scout-reedsy-genres] GET", error);
          if (cache) return json({ ok: true, genres: cache.genres, cached: true, stale: true });
          return json(
            {
              ok: false,
              error: "unavailable",
              message: "Couldn't load Reedsy's genre list. Please try again.",
            },
            503,
          );
        }
      },
    },
  },
});
