import { createFileRoute } from "@tanstack/react-router";

/** Pinged by the database (pg_net) whenever a notification is
 *  written. Needs no secret: it only emails notifications that already
 *  exist and aren't emailed yet, to the admin inbox or the expert they belong to. */
export const Route = createFileRoute("/api/notifications/dispatch")({
  server: {
    handlers: {
      POST: async () => {
        const { json, emailPendingAdminNotifications, emailPendingExpertNotifications } =
          await import("@/lib/notifications.server");
        try {
          const [admin, expert] = await Promise.all([
            emailPendingAdminNotifications(),
            emailPendingExpertNotifications(),
          ]);
          return json({ sent: admin.sent + expert.sent });
        } catch {
          return json({ sent: 0 }, 503);
        }
      },
    },
  },
});
