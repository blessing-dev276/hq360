import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PerplexityError } from "@/lib/perplexity/agent.server";
import type { AuthorContactResult } from "./perplexity-contact.server";
export const emailDb = () => supabaseAdmin as SupabaseClient;
export type EmailTarget = { authorId: string; bookId: string };
export async function createEmailRun(owner: string, budgetUsd: number, targets: EmailTarget[]) {
  const unique = [...new Map(targets.map((t) => [t.authorId, t])).values()];
  const { data, error } = await emailDb()
    .from("scout_email_runs")
    .insert({ owner, budget_usd: budgetUsd, targets: unique })
    .select("id,budget_usd,accounted_usd,targets")
    .single();
  if (error) throw new PerplexityError("Could not create email search budget.", 503);
  return data;
}
export async function checkEmailRun(id: string, owner: string, authorId?: string, bookId?: string) {
  const { data, error } = await emailDb()
    .from("scout_email_runs")
    .select("*")
    .eq("id", id)
    .eq("owner", owner)
    .maybeSingle();
  if (error) throw new PerplexityError("Could not load email search budget.", 503);
  if (
    !data ||
    (authorId &&
      !data.targets.some(
        (t: EmailTarget) => t.authorId === authorId && (!bookId || t.bookId === bookId),
      ))
  )
    throw new PerplexityError("Email search run not found.", 404);
  return data;
}
export async function reserveEmailPass(
  runId: string,
  owner: string,
  authorId: string,
  stage: number,
) {
  const { data, error } = await emailDb().rpc("reserve_scout_email_pass", {
    p_run: runId,
    p_owner: owner,
    p_author: authorId,
    p_stage: stage,
  });
  if (error)
    throw new PerplexityError("Could not reserve search budget; no new search was started.", 503);
  if (!data)
    throw new PerplexityError(
      "Budget threshold reached. Free and saved results remain available.",
      402,
    );
  return data as string;
}
export async function settleEmailPass(ticket: string, costUsd: number | null | undefined) {
  if (costUsd == null) return; // Unknown costs retain the reservation, never falsely become free.
  const { error } = await emailDb().rpc("settle_scout_email_pass", {
    p_ticket: ticket,
    p_cost: costUsd,
  });
  if (error)
    throw new PerplexityError(
      "Could not record search cost. Its reservation remains charged to this run.",
      503,
    );
}
export async function loadStageCache(authorId: string) {
  const { data, error } = await emailDb()
    .from("scout_email_stage_cache")
    .select("stage,result,checked_at")
    .eq("author_id", authorId)
    .gte("checked_at", new Date(Date.now() - 7 * 86400_000).toISOString());
  if (error) throw new PerplexityError("Could not load past searches.", 503);
  return new Map<number, AuthorContactResult>((data ?? []).map((row) => [row.stage, row.result]));
}
export async function saveStageCache(authorId: string, stage: number, result: AuthorContactResult) {
  const { error } = await emailDb()
    .from("scout_email_stage_cache")
    .upsert({ author_id: authorId, stage, result, checked_at: new Date().toISOString() });
  if (error)
    throw new PerplexityError(
      "Could not save search history; stopping to avoid duplicate charges.",
      503,
    );
}
export async function recordEmailResult(
  runId: string,
  authorId: string,
  status: string,
  contacts: AuthorContactResult["contacts"],
  checkedSources: number,
) {
  const { error } = await emailDb().from("scout_email_run_results").upsert({
    run_id: runId,
    author_id: authorId,
    status,
    contacts,
    checked_sources: checkedSources,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new PerplexityError("Could not save batch result.", 503);
}

export async function finishEmailRun(id: string, owner: string, status: "completed" | "stopped") {
  const { data, error } = await emailDb()
    .from("scout_email_runs")
    .update({ status, finished_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner", owner)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new PerplexityError("Could not update email run status.", 503);
}
