import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/expert/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const email = String(body?.email || "").trim();
        const password = String(body?.password || "");
        const fullName = String(body?.full_name || "").trim();
        const headline = String(body?.headline || "").trim();
        if (!email || password.length < 8 || !fullName || !headline) {
          return Response.json({ error: "Missing or invalid fields." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Created pre-confirmed and server-side: admin approval (expert_profiles.status)
        // is the real access gate here, so sign-in shouldn't depend on Supabase Auth's
        // own confirmation emails, which this project doesn't send.
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { account_type: "expert", full_name: fullName, headline },
        });
        if (error) {
          const message =
            error.status === 422 || /already registered/i.test(error.message)
              ? "An account with this email already exists."
              : "Could not create your account. Please try again.";
          return Response.json({ error: message }, { status: error.status === 422 ? 409 : 500 });
        }
        return Response.json({ ok: true, id: data.user?.id });
      },
    },
  },
});
