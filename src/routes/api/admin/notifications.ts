import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isAdminRequest } = await import("@/lib/admin-auth.server");
        const { json, listNotifications } = await import("@/lib/notifications.server");
        if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
        return listNotifications({ audience: "admin" });
      },
      POST: async ({ request }) => {
        const { isAdminRequest } = await import("@/lib/admin-auth.server");
        const { json, markNotifications } = await import("@/lib/notifications.server");
        if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
        return markNotifications(request, { audience: "admin" });
      },
    },
  },
});
