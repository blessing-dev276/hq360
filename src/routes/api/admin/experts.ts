import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
export const Route = createFileRoute("/api/admin/experts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { expertProfiles } = await import("@/lib/expert-auth.server");
        const { data, error } = await expertProfiles()
          .select("id, email, full_name, status, created_at, reviewed_at")
          .order("created_at", { ascending: false });
        if (error) return Response.json({ error: "Could not load experts." }, { status: 503 });
        return Response.json({ experts: data });
      },
    },
  },
});
