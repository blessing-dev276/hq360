import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/expert/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { json, listNotifications } = await import("@/lib/notifications.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        // Backup sweep, like the admin bell: catches any missed email ping.
        const { emailPendingExpertNotifications } = await import("@/lib/notifications.server");
        await emailPendingExpertNotifications().catch(() => undefined);
        return listNotifications({ audience: "expert", expertId });
      },
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { json, markNotifications } = await import("@/lib/notifications.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        return markNotifications(request, { audience: "expert", expertId });
      },
    },
  },
});
