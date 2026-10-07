import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveScoutAccess, canFindContacts } from "@/lib/scout/owner.server";
import { researchAuthorEmail } from "@/lib/scout/research-email.server";
import { PerplexityError } from "@/lib/perplexity/agent.server";
const json = (body: unknown, status = 200, retryAfter?: string) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": retryAfter } : {}) },
  });
export const Route = createFileRoute("/api/admin/scout-authors/$id/find-contact")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const access = await resolveScoutAccess(request);
        if (!access) return json({ message: "Unauthorized" }, 401);
        if (!(await canFindContacts(access)))
          return json({ message: "Scouting access required." }, 403);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ message: "Invalid origin." }, 403);
        try {
          const id = z.string().uuid().parse(params.id);
          const raw = await request.text();
          const body = z
            .object({
              bookId: z.string().uuid().optional(),
              retry: z.boolean().optional(),
              runId: z.string().uuid().optional(),
            })
            .strict()
            .parse(raw ? JSON.parse(raw) : {});
          return json(await researchAuthorEmail(access, id, body));
        } catch (error) {
          if (error instanceof PerplexityError)
            return json({ message: error.message }, error.status, error.retryAfter);
          if (error instanceof z.ZodError || error instanceof SyntaxError)
            return json({ message: "Invalid research request." }, 400);
          return json(
            {
              message:
                "Could not research this author. Saved passes will be reused when you retry.",
            },
            503,
          );
        }
      },
    },
  },
});
