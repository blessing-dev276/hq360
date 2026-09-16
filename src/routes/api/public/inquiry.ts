import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(320),
  company: z.string().max(200).optional().or(z.literal("")),
  website: z.string().max(300).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  helpWith: z.array(z.string().max(120)).max(20).optional(),
  primaryGoal: z.string().max(300).optional().or(z.literal("")),
  budgetRange: z.string().max(80).optional().or(z.literal("")),
  timeline: z.string().max(80).optional().or(z.literal("")),
  message: z.string().max(4000).optional().or(z.literal("")),
  sourcePath: z.string().max(300).optional().or(z.literal("")),
  sourceIndustry: z.string().max(120).optional().or(z.literal("")),
  /** Honeypot — must be empty. */
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

export const Route = createFileRoute("/api/public/inquiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof schema>;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }

        // Honeypot tripped — accept silently, do nothing.
        if (parsed.company_url) return json({ ok: true });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("project_inquiries")
            .insert({
              name: parsed.name,
              email: parsed.email,
              company: parsed.company || null,
              website: parsed.website || null,
              industry: parsed.industry || parsed.sourceIndustry || null,
              help_with: parsed.helpWith ?? [],
              primary_goal: parsed.primaryGoal || null,
              budget_range: parsed.budgetRange || null,
              timeline: parsed.timeline || null,
              message: parsed.message || null,
              source_path: parsed.sourcePath || null,
              source_industry: parsed.sourceIndustry || null,
            })
            .select("id, created_at")
            .single();

          if (error || !data) {
            console.error("[inquiry] insert failed", error?.message);
            return json({ ok: false, error: "storage" }, 500);
          }

          let forwarded = false;
          try {
            const { forwardLead } = await import("@/lib/lead-forwarding.server");
            const res = await forwardLead({
              kind: "project_inquiry",
              id: data.id,
              createdAt: data.created_at,
              email: parsed.email,
              name: parsed.name,
              company: parsed.company || undefined,
              website: parsed.website || undefined,
              industry: parsed.industry || parsed.sourceIndustry || undefined,
              sourcePath: parsed.sourcePath || undefined,
              fields: {
                helpWith: parsed.helpWith ?? [],
                primaryGoal: parsed.primaryGoal || undefined,
                budgetRange: parsed.budgetRange || undefined,
                timeline: parsed.timeline || undefined,
                message: parsed.message || undefined,
              },
            });
            forwarded = res.forwarded;
            if (forwarded) {
              await supabaseAdmin
                .from("project_inquiries")
                .update({ forwarded_at: new Date().toISOString() })
                .eq("id", data.id);
            }
          } catch (err) {
            console.error("[inquiry] forward failed", err instanceof Error ? err.message : err);
          }

          let emailed = false;
          try {
            const { sendLeadEmail } = await import("@/lib/email.server");
            const result = await sendLeadEmail({
              subject: `New HQ360 inquiry from ${parsed.name}`,
              replyTo: parsed.email,
              text: [
                "New HQ360 inquiry",
                "",
                `Name: ${parsed.name}`,
                `Email: ${parsed.email}`,
                `Company: ${parsed.company || "N/A"}`,
                `Website: ${parsed.website || "N/A"}`,
                `Industry: ${parsed.industry || parsed.sourceIndustry || "N/A"}`,
                `Need help with: ${parsed.helpWith?.join(", ") || "N/A"}`,
                `Primary goal: ${parsed.primaryGoal || "N/A"}`,
                `Budget: ${parsed.budgetRange || "N/A"}`,
                `Timeline: ${parsed.timeline || "N/A"}`,
                `Source path: ${parsed.sourcePath || "N/A"}`,
                "",
                "Message:",
                parsed.message || "N/A",
              ].join("\n"),
            });
            emailed = result.sent;
            if (!result.sent) {
              console.warn("[inquiry] direct email not sent", result.error);
            }
          } catch (err) {
            console.error(
              "[inquiry] direct email failed",
              err instanceof Error ? err.message : err,
            );
          }

          return json({ ok: true, id: data.id, forwarded, emailed });
        } catch (err) {
          console.error("[inquiry] handler error", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
