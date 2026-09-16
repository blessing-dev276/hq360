import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records a manually-uploaded piece of visual evidence (screenshot, book
 * cover, manual chart). The file itself is uploaded client-side via the
 * existing signed-upload flow (bucket "audit-evidence") — this just links
 * the resulting URL to the audit. There is deliberately no automated
 * screenshot capture here: scraping Amazon/Goodreads/social pages violates
 * their terms, so visual evidence is upload-only. */
const createSchema = z.object({
  storageUrl: z.string().min(1).max(2000),
  caption: z.string().max(500).optional(),
  source: z.string().max(300).optional(),
  assetDate: z.string().max(40).optional(),
  findingId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/admin/author-audits/$id/evidence-assets")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "not_found" }, 404);
        let body: z.infer<typeof createSchema>;
        try {
          body = createSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          const { data, error } = await db
            .from("audit_evidence_assets")
            .insert({
              audit_id: params.id,
              finding_id: body.findingId || null,
              storage_url: body.storageUrl,
              caption: body.caption || null,
              source: body.source || null,
              asset_date: body.assetDate || null,
              client_visible: false,
            })
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data }, 201);
        } catch (err) {
          console.error(
            "[admin/author-audits/:id/evidence-assets] POST",
            err instanceof Error ? err.message : err,
          );
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
