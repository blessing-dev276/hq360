import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

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

        // Counting on each keystroke bypassed source controls and consumed quota.
        // Discovery reports actual results; unknown availability stays unknown.
        return json({ ok: true, perSource: {}, total: null });
      },
    },
  },
});
