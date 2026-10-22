import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/author-outreach")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isAdminRequest } = await import("@/lib/admin-auth.server");
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        return (await import("@/lib/author-outreach.server")).listOutreach(request);
      },
      PATCH: async ({ request }) => {
        const { isAdminRequest } = await import("@/lib/admin-auth.server");
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return Response.json({ error: "Invalid origin" }, { status: 403 });
        return (await import("@/lib/author-outreach.server")).updateOutreach(request);
      },
    },
  },
});
