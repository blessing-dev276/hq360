import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(320),
  sourcePath: z.string().max(300).optional().or(z.literal("")),
  // Honeypot — see the comment in growth-audit.ts's schema for why this
  // isn't length-capped.
  company_url: z.string().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/newsletter")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof schema>;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        if (parsed.company_url) return json({ ok: true });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("newsletter_subscribers").upsert(
            {
              email: parsed.email.toLowerCase(),
              source_path: parsed.sourcePath || null,
              status: "subscribed",
              unsubscribed_at: null,
            },
            { onConflict: "email" },
          );

          if (error) {
            console.error("[newsletter] upsert failed", error.message);
            return json({ ok: false, error: "storage" }, 500);
          }

          return json({ ok: true });
        } catch (err) {
          console.error("[newsletter] handler error", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
