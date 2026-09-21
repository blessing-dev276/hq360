import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { reedsyPolicy } from "@/lib/scout/sources/reedsy/policy";
export const Route = createFileRoute("/api/admin/scout-discover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        const parsed = z
          .object({ genre: z.string().trim().min(1).max(80) })
          .strict()
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ ok: false, error: "Choose a genre." }, { status: 400 });
        // Do not create empty batches or claim a successful scrape while access is manual-only.
        return Response.json(
          { ok: false, error: "reedsy_permission_required", message: reedsyPolicy.reason },
          { status: 409 },
        );
      },
    },
  },
});
