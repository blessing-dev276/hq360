import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
/** Invite a guest: a login with only the tools the admin picks, no profile. */
export const Route = createFileRoute("/api/admin/expert-guests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { guestInviteSchema, inviteGuest } = await import("@/lib/expert-guests.server");
        const parsed = guestInviteSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json(
            { error: parsed.error.issues[0]?.message || "Check the details." },
            { status: 400 },
          );
        try {
          return Response.json({ ok: true, ...(await inviteGuest(parsed.data)) });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Could not invite this guest." },
            { status: 409 },
          );
        }
      },
    },
  },
});
