import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/expert/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        return Response.json(
          { authed: Boolean(expertId) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const { approvedProfileForToken, expertSessionCookie } =
          await import("@/lib/expert-auth.server");
        const body = await request.json().catch(() => null);
        const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
        if (!accessToken) return Response.json({ error: "Missing access token" }, { status: 400 });
        const profile = await approvedProfileForToken(accessToken);
        if (!profile) {
          // Distinguish "not an expert account at all / bad token" from
          // "account exists but is still pending/rejected" for the UI.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { expertProfiles } = await import("@/lib/expert-auth.server");
          const { data } = await supabaseAdmin.auth.getUser(accessToken);
          if (data.user) {
            const { data: row } = await expertProfiles()
              .select("status")
              .eq("id", data.user.id)
              .maybeSingle();
            if (row)
              return Response.json(
                { error: "Account not approved yet", status: (row as { status: string }).status },
                { status: 403 },
              );
          }
          return Response.json({ error: "Invalid session" }, { status: 401 });
        }
        return Response.json(
          { authed: true, email: profile.email },
          {
            headers: {
              "Set-Cookie": await expertSessionCookie(profile.id),
              "Cache-Control": "no-store",
            },
          },
        );
      },
      DELETE: async () => {
        const { clearExpertCookie } = await import("@/lib/expert-auth.server");
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": clearExpertCookie(), "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
