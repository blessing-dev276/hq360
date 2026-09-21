import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { z } from "zod";
export const Route = createFileRoute("/api/admin/scout-crawl")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        const body = z
          .object({ slug: z.string().max(80) })
          .safeParse(await request.json().catch(() => null));
        if (!body.success) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
        try {
          const { crawlSource } = await import("@/lib/scout/crawler.server");
          return Response.json({ ok: true, ...(await crawlSource(body.data.slug)) });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Crawl failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
