-- Publication metadata and immutable versions of the existing audit, not a second engine.
CREATE TABLE public.audit_client_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  snapshot jsonb NOT NULL,
  qa_confirmed boolean NOT NULL DEFAULT false
);
CREATE INDEX ON public.audit_client_versions(audit_id, created_at DESC);
CREATE TABLE public.audit_client_access (
  audit_id uuid PRIMARY KEY REFERENCES public.author_audits(id) ON DELETE CASCADE,
  public_slug text NOT NULL UNIQUE,
  code_hash text UNIQUE,
  secure_share_token_hash text,
  generation uuid NOT NULL DEFAULT gen_random_uuid(),
  version_id uuid REFERENCES public.audit_client_versions(id) ON DELETE SET NULL,
  published_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  access_enabled boolean NOT NULL DEFAULT false,
  view_count bigint NOT NULL DEFAULT 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz
);
CREATE TABLE public.audit_client_sessions (
  token_hash text PRIMARY KEY,
  audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  generation uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE public.audit_client_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.audit_client_versions(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('opened','section','finding','evidence')),
  target text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_client_events(audit_id, created_at DESC);
CREATE TABLE public.audit_client_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.author_audits(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.audit_client_versions(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL,
  recommendation_id uuid NOT NULL,
  author_interest text NOT NULL CHECK (author_interest IN ('saved','help','question')),
  question text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, finding_id, author_interest)
);
CREATE TABLE public.audit_access_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.audit_access_rate_limit(bucket_key text, attempt_limit integer, window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO audit_access_attempts(bucket, attempts, window_start) VALUES(bucket_key, 1, now())
  ON CONFLICT(bucket) DO UPDATE SET
    attempts = CASE WHEN audit_access_attempts.window_start < now() - make_interval(secs => window_seconds) THEN 1 ELSE audit_access_attempts.attempts + 1 END,
    window_start = CASE WHEN audit_access_attempts.window_start < now() - make_interval(secs => window_seconds) THEN now() ELSE audit_access_attempts.window_start END
  RETURNING attempts INTO n;
  RETURN n <= attempt_limit;
END $$;
CREATE FUNCTION public.audit_client_record_view(target_audit uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE audit_client_access SET view_count = view_count + 1,
    first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
  WHERE audit_id = target_audit;
$$;
REVOKE ALL ON FUNCTION public.audit_access_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_client_record_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_access_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_client_record_view(uuid) TO service_role;
ALTER TABLE public.audit_client_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_client_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_client_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_access_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_client_versions, public.audit_client_access, public.audit_client_sessions,
 public.audit_client_events, public.audit_client_interest, public.audit_access_attempts FROM anon, authenticated;
GRANT ALL ON public.audit_client_versions, public.audit_client_access, public.audit_client_sessions,
 public.audit_client_events, public.audit_client_interest, public.audit_access_attempts TO service_role;
-- No access rows are inserted: all existing audits, including Donna's, remain unpublished.

CREATE FUNCTION public.audit_client_snapshot_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.audit_id <> OLD.audit_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Report snapshots are immutable; create a new version';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_client_snapshot_immutable BEFORE UPDATE ON public.audit_client_versions
FOR EACH ROW EXECUTE FUNCTION public.audit_client_snapshot_immutable();

CREATE FUNCTION public.audit_client_publish(p_audit uuid, p_version uuid, p_slug text, p_code_hash text, p_token_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM author_audits WHERE id = p_audit FOR UPDATE;
  UPDATE audit_client_versions SET published_at = now(), qa_confirmed = true
    WHERE id = p_version AND audit_id = p_audit AND published_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft is no longer available'; END IF;
  INSERT INTO audit_client_access(audit_id,public_slug,version_id,published_at,access_enabled,code_hash,secure_share_token_hash)
    VALUES(p_audit,p_slug,p_version,now(),true,p_code_hash,p_token_hash)
  ON CONFLICT(audit_id) DO UPDATE SET version_id = p_version,published_at = now(),access_enabled = true,revoked_at = NULL,
    code_hash = coalesce(p_code_hash,audit_client_access.code_hash),
    secure_share_token_hash = coalesce(p_token_hash,audit_client_access.secure_share_token_hash),
    generation = CASE WHEN p_code_hash IS NULL THEN audit_client_access.generation ELSE gen_random_uuid() END;
END $$;
REVOKE ALL ON FUNCTION public.audit_client_publish(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_client_publish(uuid, uuid, text, text, text) TO service_role;
