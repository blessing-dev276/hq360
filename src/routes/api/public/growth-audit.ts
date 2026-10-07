import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(160).optional().or(z.literal("")),
  website: z.string().max(300).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  auditFocus: z.string().max(160).optional().or(z.literal("")),
  sourcePath: z.string().max(300).optional().or(z.literal("")),
  // Honeypot — real visitors never fill this (it's hidden), but a
  // password-manager/autofill extension can stuff it despite
  // autocomplete="off". Don't cap the length here: that would reject the
  // whole request with a validation error instead of the silent-accept
  // path below, which is what actually happens to bots.
  company_url: z.string().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/growth-audit")({
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

          // See the matching comment in author-audit.ts: a dropped
          // connection can make a successful submission look failed to the
          // visitor, who then resubmits. Treat an identical submission in
          // the last 5 minutes as the same request rather than a new lead.
          const dedupeWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          let dedupeQuery = supabaseAdmin
            .from("growth_audit_requests")
            .select("id")
            .eq("email", parsed.email)
            .gte("created_at", dedupeWindow);
          dedupeQuery = parsed.website
            ? dedupeQuery.eq("website", parsed.website)
            : dedupeQuery.is("website", null);
          const { data: recent } = await dedupeQuery.limit(1).maybeSingle();
          if (recent) return json({ ok: true, id: (recent as { id: string }).id });

          const { data, error } = await supabaseAdmin
            .from("growth_audit_requests")
            .insert({
              email: parsed.email,
              name: parsed.name || null,
              website: parsed.website || null,
              industry: parsed.industry || null,
              audit_focus: parsed.auditFocus || null,
              source_path: parsed.sourcePath || null,
            })
            .select("id, created_at")
            .single();

          if (error || !data) {
            console.error("[growth-audit] insert failed", error?.message);
            return json({ ok: false, error: "storage" }, 500);
          }

          try {
            const { forwardLead } = await import("@/lib/lead-forwarding.server");
            const res = await forwardLead({
              kind: "growth_audit_request",
              id: data.id,
              createdAt: data.created_at,
              email: parsed.email,
              name: parsed.name || undefined,
              website: parsed.website || undefined,
              industry: parsed.industry || undefined,
              sourcePath: parsed.sourcePath || undefined,
              fields: { auditFocus: parsed.auditFocus || undefined },
            });
            if (res.forwarded) {
              await supabaseAdmin
                .from("growth_audit_requests")
                .update({ forwarded_at: new Date().toISOString() })
                .eq("id", data.id);
            }
          } catch (err) {
            console.error(
              "[growth-audit] forward failed",
              err instanceof Error ? err.message : err,
            );
          }

          try {
            const { sendLeadEmail } = await import("@/lib/email.server");
            const result = await sendLeadEmail({
              subject: `New HQ360 growth audit request from ${parsed.name || parsed.email}`,
              replyTo: parsed.email,
              text: [
                "New HQ360 growth audit request",
                "",
                `Name: ${parsed.name || "N/A"}`,
                `Email: ${parsed.email}`,
                `Website: ${parsed.website || "N/A"}`,
                `Industry: ${parsed.industry || "N/A"}`,
                `Audit focus: ${parsed.auditFocus || "N/A"}`,
                `Source path: ${parsed.sourcePath || "N/A"}`,
                "",
                "Submitted details:",
                JSON.stringify(
                  {
                    email: parsed.email,
                    name: parsed.name || null,
                    website: parsed.website || null,
                    industry: parsed.industry || null,
                    auditFocus: parsed.auditFocus || null,
                    sourcePath: parsed.sourcePath || null,
                  },
                  null,
                  2,
                ),
              ].join("\n"),
            });
            if (!result.sent) {
              console.warn("[growth-audit] direct email not sent", result.error);
            }
          } catch (err) {
            console.error(
              "[growth-audit] direct email failed",
              err instanceof Error ? err.message : err,
            );
          }

          return json({ ok: true, id: data.id });
        } catch (err) {
          console.error("[growth-audit] handler error", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
