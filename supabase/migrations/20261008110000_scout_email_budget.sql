CREATE TABLE public.scout_email_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner text NOT NULL,
 budget_usd numeric(12,6) NOT NULL CHECK (budget_usd BETWEEN 0.1 AND 25),
 accounted_usd numeric(12,6) NOT NULL DEFAULT 0,
 targets jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scout_email_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.scout_email_runs(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
 stage integer NOT NULL, reserved_usd numeric(12,6) NOT NULL DEFAULT 0.10,
 actual_usd numeric(12,6), settled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scout_email_stage_cache (
 author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
 stage integer NOT NULL, result jsonb NOT NULL, checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(author_id,stage)
);
CREATE TABLE public.scout_email_run_results (
 run_id uuid NOT NULL REFERENCES public.scout_email_runs(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
 status text NOT NULL, contacts jsonb NOT NULL DEFAULT '[]', checked_sources integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id,author_id)
);
CREATE TABLE public.scout_email_locks (
 author_id uuid PRIMARY KEY REFERENCES public.scout_authors(id) ON DELETE CASCADE,
 token uuid NOT NULL, expires_at timestamptz NOT NULL
);
ALTER TABLE public.scout_authors ADD COLUMN contact_evidence jsonb;
ALTER TABLE public.scout_email_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_email_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_email_stage_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_email_run_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_email_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scout_email_runs, public.scout_email_attempts, public.scout_email_stage_cache, public.scout_email_run_results, public.scout_email_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scout_email_runs, public.scout_email_attempts, public.scout_email_stage_cache, public.scout_email_run_results, public.scout_email_locks TO service_role;

CREATE FUNCTION public.reserve_scout_email_pass(p_run uuid, p_owner text, p_author uuid, p_stage integer)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ticket uuid;
BEGIN
 UPDATE scout_email_runs SET accounted_usd = accounted_usd + 0.10
 WHERE id = p_run AND owner = p_owner AND accounted_usd + 0.10 <= budget_usd
 AND targets @> jsonb_build_array(jsonb_build_object('authorId', p_author::text));
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO scout_email_attempts(run_id,author_id,stage) VALUES(p_run,p_author,p_stage) RETURNING id INTO ticket;
 RETURN ticket;
END $$;
CREATE FUNCTION public.settle_scout_email_pass(p_ticket uuid, p_cost numeric)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r scout_email_attempts;
BEGIN
 IF p_cost IS NULL OR p_cost < 0 THEN RETURN; END IF;
 SELECT * INTO r FROM scout_email_attempts WHERE id = p_ticket FOR UPDATE;
 IF NOT FOUND OR r.settled THEN RETURN; END IF;
 UPDATE scout_email_attempts SET actual_usd=p_cost,settled=true WHERE id=p_ticket;
 UPDATE scout_email_runs SET accounted_usd=accounted_usd-r.reserved_usd+p_cost WHERE id=r.run_id;
END $$;
CREATE FUNCTION public.claim_scout_email_author(p_author uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 INSERT INTO scout_email_locks(author_id,token,expires_at) VALUES(p_author,p_token,now()+interval '15 minutes')
 ON CONFLICT(author_id) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE scout_email_locks.expires_at < now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.reserve_scout_email_pass(uuid,text,uuid,integer), public.settle_scout_email_pass(uuid,numeric), public.claim_scout_email_author(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_scout_email_pass(uuid,text,uuid,integer), public.settle_scout_email_pass(uuid,numeric), public.claim_scout_email_author(uuid,uuid) TO service_role;
