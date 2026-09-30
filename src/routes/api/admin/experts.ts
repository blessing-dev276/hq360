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
          .select(
            "id, email, full_name, headline, status, created_at, reviewed_at, slug, is_public",
          )
          .order("created_at", { ascending: false });
        if (error) {
          const missingTable = error.code === "42P01" || error.code === "PGRST205";
          return Response.json(
            {
              error: missingTable
                ? "Expert accounts aren't set up in the database yet. Apply the latest Supabase migrations (supabase db push), then refresh."
                : "Could not load experts.",
            },
            { status: 503 },
          );
        }
        return Response.json({ experts: data });
      },
    },
  },
});
