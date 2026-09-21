import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/cron/scout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET || process.env.SCOUT_CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
          return Response.json({ ok: false }, { status: 401 });
        try {
          const { runScheduledCrawl } = await import("@/lib/scout/crawler.server");
          return Response.json({ ok: true, result: await runScheduledCrawl() });
        } catch (error) {
          console.error("[scout/cron]", error);
          return Response.json({ ok: false, error: "Scheduler failed" }, { status: 500 });
        }
      },
    },
  },
});
