import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  visitorId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  path: z.string().startsWith("/").max(300),
  referrer: z.string().max(500).optional(),
});

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;

function referrerHost(value: string | undefined, own: string) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host && host !== own ? host : null;
  } catch {
    return null;
  }
}

/** Records one page view. Never stores the IP; country comes from the edge geo header. */
export const Route = createFileRoute("/api/public/visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ok = () => new Response(null, { status: 204 });
        const ua = request.headers.get("user-agent") ?? "";
        if (BOT.test(ua)) return ok();
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return ok();
        const country = (
          request.headers.get("x-vercel-ip-country") ??
          request.headers.get("cf-ipcountry") ??
          ""
        )
          .toUpperCase()
          .slice(0, 2);
        const device = /ipad|tablet/i.test(ua)
          ? "tablet"
          : /mobi|android|iphone/i.test(ua)
            ? "mobile"
            : "desktop";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as unknown as SupabaseClient).from("site_visits").insert({
            visitor_id: parsed.data.visitorId,
            path: parsed.data.path.split("?")[0]!.slice(0, 300),
            referrer_host: referrerHost(
              parsed.data.referrer,
              new URL(request.url).hostname.replace(/^www\./, ""),
            ),
            country: /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null,
            device,
          });
        } catch {
          // Analytics must never break the page.
        }
        return ok();
      },
    },
  },
});
