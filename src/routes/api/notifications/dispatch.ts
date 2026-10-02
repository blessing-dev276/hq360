import { createFileRoute } from "@tanstack/react-router";

/** Pinged by the database (pg_net) whenever an admin notification is
 *  written. Needs no secret: it only emails notifications that already
 *  exist and aren't emailed yet, always to the fixed admin inbox. */
export const Route = createFileRoute("/api/notifications/dispatch")({
  server: {
    handlers: {
      POST: async () => {
        const { json, emailPendingAdminNotifications } = await import("@/lib/notifications.server");
        try {
          return json(await emailPendingAdminNotifications());
        } catch {
          return json({ sent: 0 }, 503);
        }
      },
    },
  },
});
