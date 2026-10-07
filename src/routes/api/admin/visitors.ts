import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminRequest } from "@/lib/admin-auth.server";

type Row = {
  created_at: string;
  visitor_id: string;
  path: string;
  referrer_host: string | null;
  country: string | null;
  device: string | null;
};

function top(values: (string | null)[], limit = 10) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value ?? "", (counts.get(value ?? "") ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

/** Aggregated visitor stats for the last 1–90 days. */
export const Route = createFileRoute("/api/admin/visitors")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const days = Math.min(
          90,
          Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30),
        );
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await (supabaseAdmin as unknown as SupabaseClient)
          .from("site_visits")
          .select("created_at, visitor_id, path, referrer_host, country, device")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50000);
        if (error) {
          const missing = error.code === "42P01" || error.code === "PGRST205";
          return Response.json(
            {
              error: missing
                ? "Visitor tracking isn't set up in the database yet. Run supabase db push, then refresh."
                : "Could not load visitor stats.",
            },
            { status: 503 },
          );
        }
        const rows = (data ?? []) as Row[];
        const daily = new Map<string, { views: number; visitors: Set<string> }>();
        for (let i = days - 1; i >= 0; i--)
          daily.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), {
            views: 0,
            visitors: new Set(),
          });
        for (const row of rows) {
          const day = daily.get(row.created_at.slice(0, 10));
          if (day) {
            day.views++;
            day.visitors.add(row.visitor_id);
          }
        }
        // One country per visitor, so a visitor isn't counted once per page view.
        const visitorCountry = new Map<string, string | null>();
        for (const row of rows)
          if (!visitorCountry.has(row.visitor_id)) visitorCountry.set(row.visitor_id, row.country);
        return Response.json(
          {
            days,
            views: rows.length,
            visitors: visitorCountry.size,
            daily: [...daily.entries()].map(([date, d]) => ({
              date,
              views: d.views,
              visitors: d.visitors.size,
            })),
            countries: top([...visitorCountry.values()], 25),
            pages: top(rows.map((r) => r.path)),
            referrers: top(rows.map((r) => r.referrer_host).filter(Boolean)),
            devices: top(
              rows.map((r) => r.device),
              3,
            ),
            recent: rows.slice(0, 25).map((r) => ({
              at: r.created_at,
              path: r.path,
              country: r.country,
              device: r.device,
            })),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
