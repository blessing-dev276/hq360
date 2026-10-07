import { createFileRoute } from "@tanstack/react-router";

/** Pinged by the database (pg_net) when a Scout contact email is set. Needs
 *  no auth: it takes no input and only processes emails already marked
 *  pending, writing the result back to the same row. */
export const Route = createFileRoute("/api/scout/verify-emails")({
  server: {
    handlers: {
      POST: async () => {
        const { runPendingEmailChecks } = await import("@/lib/scout/email-check-runner.server");
        try {
          return Response.json(await runPendingEmailChecks(), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch {
          return Response.json({ checked: 0 }, { status: 503 });
        }
      },
    },
  },
});
