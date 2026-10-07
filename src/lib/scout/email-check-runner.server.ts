import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkEmail } from "./email-check.server";

type Claimed = {
  kind: "author" | "lead";
  id: string;
  email: string;
  website_url: string | null;
  source_url: string | null;
};

/** Claim pending email checks, run them (a few at a time) and store results.
 *  Keeps claiming batches within a time budget so a backlog drains in one
 *  ping; anything left is picked up by the next ping (stuck claims are
 *  reclaimed after 5 minutes). A result is only written if the row still has
 *  the email that was checked. */
export async function runPendingEmailChecks(limit = 20, budgetMs = 25_000) {
  const db = supabaseAdmin as unknown as SupabaseClient;
  const started = Date.now();
  let checked = 0;
  while (Date.now() - started < budgetMs) {
    const { data, error } = await db.rpc("scout_claim_email_checks", { p_limit: limit });
    if (error) throw error;
    const rows = (data ?? []) as Claimed[];
    if (!rows.length) break;
    for (let i = 0; i < rows.length; i += 5) {
      await Promise.all(
        rows.slice(i, i + 5).map(async (row) => {
          const result = await checkEmail({
            email: row.email,
            websiteUrl: row.website_url,
            sourceUrl: row.source_url,
          });
          const table = row.kind === "author" ? "scout_authors" : "scout_audience_leads";
          await db
            .from(table)
            .update({
              email_check_status: result.status,
              email_check: { checks: result.checks, reasons: result.reasons },
              email_checked_at: new Date().toISOString(),
            })
            .eq("id", row.id)
            .eq("contact_email", row.email);
          checked++;
        }),
      );
    }
  }
  return { checked };
}
