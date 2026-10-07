import { createFileRoute } from "@tanstack/react-router";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Guest invite links: look up who the link is for, then set a password. */
export const Route = createFileRoute("/api/expert/invite")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { inviteDetails } = await import("@/lib/expert-guests.server");
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const details = await inviteDetails(token);
        if (!details)
          return Response.json(
            { error: "This invite link is invalid or has expired. Ask HQ360 for a new one." },
            { status: 404, headers },
          );
        return Response.json(details, { headers });
      },
      POST: async ({ request }) => {
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return Response.json({ error: "Invalid origin" }, { status: 403, headers });
        const body = await request.json().catch(() => null);
        const token = typeof body?.token === "string" ? body.token : "";
        const password = typeof body?.password === "string" ? body.password : "";
        if (password.length < 8 || password.length > 72)
          return Response.json(
            { error: "Use a password of at least 8 characters." },
            { status: 400, headers },
          );
        const { acceptInvite } = await import("@/lib/expert-guests.server");
        try {
          return Response.json(await acceptInvite(token, password), { headers });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Could not accept the invite." },
            { status: 410, headers },
          );
        }
      },
    },
  },
});
