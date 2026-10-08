-- Keep historical budgets, but new runs have no spending cap.
ALTER TABLE public.scout_email_runs ALTER COLUMN budget_usd DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_scout_email_pass(p_run uuid, p_owner text, p_author uuid, p_stage integer)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ticket uuid;
BEGIN
 UPDATE scout_email_runs SET accounted_usd = accounted_usd + 0.10
 WHERE id = p_run AND owner = p_owner AND status = 'running'
 AND targets @> jsonb_build_array(jsonb_build_object('authorId', p_author::text));
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO scout_email_attempts(run_id,author_id,stage) VALUES(p_run,p_author,p_stage) RETURNING id INTO ticket;
 RETURN ticket;
END $$;
