import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { SOURCE_ADAPTERS } from "@/lib/scout/adapters";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const bodySchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    genre: z.string().trim().max(80).optional(),
    sources: z.array(z.string()).optional(),
  })
  .refine((v) => Boolean(v.query?.trim() || v.genre?.trim()), {
    message: "query_or_genre_required",
  });

export const Route = createFileRoute("/api/admin/scout-discover-count")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        const slugs = (
          body.sources && body.sources.length > 0 ? body.sources : Object.keys(SOURCE_ADAPTERS)
        ).filter((slug) => slug in SOURCE_ADAPTERS);

        const perSource = Object.fromEntries(
          await Promise.all(
            slugs.map(async (slug) => {
              const adapter = SOURCE_ADAPTERS[slug];
              if (!adapter?.countAvailable) return [slug, null] as const;
              const count = await adapter.countAvailable({
                query: body.query?.trim() || "",
                genre: body.genre,
              });
              return [slug, count] as const;
            }),
          ),
        );

        const known = Object.values(perSource).filter((n): n is number => typeof n === "number");
        const total = known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
        return json({ ok: true, perSource, total });
      },
    },
  },
});
