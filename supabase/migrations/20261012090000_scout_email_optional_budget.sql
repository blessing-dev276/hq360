-- Optional spending limit per email search run. A run with budget_usd set
-- stops paid searches once the next pass would exceed it; null = no limit.
-- Each paid pass sets aside an estimate, then settles to Perplexity's real cost.
ALTER TABLE public.scout_email_attempts ALTER COLUMN reserved_usd SET DEFAULT 0.05;

CREATE OR REPLACE FUNCTION public.reserve_scout_email_pass(p_run uuid, p_owner text, p_author uuid, p_stage integer)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ticket uuid;
BEGIN
 UPDATE scout_email_runs SET accounted_usd = accounted_usd + 0.05
 WHERE id = p_run AND owner = p_owner AND status = 'running'
 AND (budget_usd IS NULL OR accounted_usd + 0.05 <= budget_usd)
 AND targets @> jsonb_build_array(jsonb_build_object('authorId', p_author::text));
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO scout_email_attempts(run_id,author_id,stage,reserved_usd)
   VALUES(p_run,p_author,p_stage,0.05) RETURNING id INTO ticket;
 RETURN ticket;
END $$;
REVOKE ALL ON FUNCTION public.reserve_scout_email_pass(uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_scout_email_pass(uuid,text,uuid,integer) TO service_role;

-- Allow bigger batches than the old $25 pilot ceiling.
ALTER TABLE public.scout_email_runs DROP CONSTRAINT IF EXISTS scout_email_runs_budget_usd_check;
ALTER TABLE public.scout_email_runs
  ADD CONSTRAINT scout_email_runs_budget_usd_check CHECK (budget_usd IS NULL OR budget_usd BETWEEN 0.05 AND 500);
