import { createFileRoute } from "@tanstack/react-router";

/** Unsubscribe from HQ360 outreach. POST only: used by mail providers'
 *  one-click Unsubscribe (RFC 8058) and by the confirm button on /unsubscribe.
 *  The signed token proves the request came from a real email we sent. */
export const Route = createFileRoute("/api/outreach/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let email = url.searchParams.get("e") ?? "";
        let token = url.searchParams.get("t") ?? "";
        if (!email || !token) {
          const form = await request.formData().catch(() => null);
          email = String(form?.get("e") ?? "");
          token = String(form?.get("t") ?? "");
        }
        const { validUnsubscribe, outreachSuppressions } = await import("@/lib/outreach.server");
        email = email.trim().toLowerCase();
        if (!validUnsubscribe(email, token))
          return Response.json({ ok: false, error: "Invalid unsubscribe link." }, { status: 400 });
        const { error } = await outreachSuppressions().upsert(
          { email, reason: "unsubscribed" },
          { onConflict: "email", ignoreDuplicates: true },
        );
        if (error) return Response.json({ ok: false, error: "Please try again." }, { status: 503 });
        return Response.json({ ok: true });
      },
    },
  },
});
