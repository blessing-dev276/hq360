-- Client tracking pages (spec features B, C 4.1 and E): one private,
-- passcode protected progress page per client, run from the Expert dashboard.
-- Passcodes are stored only as bcrypt hashes. The client page renders
-- published_snapshot, so working edits stay private until the expert publishes.

CREATE TABLE public.client_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 120),
  client_email text CHECK (client_email IS NULL OR char_length(client_email) <= 254),
  project_title text NOT NULL DEFAULT '' CHECK (char_length(project_title) <= 200),
  package_name text NOT NULL DEFAULT '' CHECK (char_length(package_name) <= 120),
  -- {client-slug}-{4 random characters}; the random part stops guessing.
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*-[a-z0-9]{4}$' AND char_length(slug) <= 80),
  -- bcrypt only ($2a$/$2b$/$2y$); a plain passcode can never be saved here.
  passcode_hash text CHECK (passcode_hash IS NULL OR passcode_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$'),
  -- Bumped on every passcode reset so old 30 day unlock cookies stop working.
  passcode_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'archived')),
  portfolio_consent boolean NOT NULL DEFAULT false,
  published_snapshot jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'live' OR (passcode_hash IS NOT NULL AND published_snapshot IS NOT NULL))
);
CREATE INDEX client_trackers_expert_idx ON public.client_trackers (expert_id, updated_at DESC);

CREATE TABLE public.tracker_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'next' CHECK (status IN ('next', 'progress', 'done')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  is_free_bonus boolean NOT NULL DEFAULT false,
  portfolio_ready boolean NOT NULL DEFAULT false,
  -- checklist, list tracker, button link and highlight box (see src/lib/trackers/core.ts).
  blocks jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(blocks) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_items_tracker_idx ON public.tracker_items (tracker_id, position);

CREATE TABLE public.tracker_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.tracker_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'video', 'pdf', 'other')),
  -- Path inside the private tracker-files bucket; served only via signed links.
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 200),
  size bigint NOT NULL DEFAULT 0 CHECK (size >= 0),
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_files_item_idx ON public.tracker_files (item_id, position);

CREATE TABLE public.tracker_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  author_id uuid REFERENCES public.expert_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_log_tracker_idx ON public.tracker_log_entries (tracker_id, entry_date DESC, created_at DESC);

-- View tracking: no raw IP is ever stored. visitor_hash is an HMAC that rotates daily.
CREATE TABLE public.tracker_view_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('open', 'unlock', 'fail', 'play', 'download')),
  item_id uuid REFERENCES public.tracker_items(id) ON DELETE SET NULL,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  user_agent_family text CHECK (char_length(user_agent_family) <= 40),
  country text CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_view_events_tracker_idx ON public.tracker_view_events (tracker_id, created_at DESC);

-- Five wrong passcodes lock the page for that visitor for 15 minutes.
-- visitor_key is an HMAC of the visitor's network address, never the address.
CREATE TABLE public.tracker_unlock_attempts (
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  visitor_key text NOT NULL CHECK (visitor_key ~ '^[a-f0-9]{64}$'),
  failures integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tracker_id, visitor_key)
);

/** Null when the visitor may try a passcode, otherwise when the lock ends. */
CREATE FUNCTION public.tracker_lock_until(p_tracker uuid, p_visitor text)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT locked_until FROM public.tracker_unlock_attempts
  WHERE tracker_id = p_tracker AND visitor_key = p_visitor AND locked_until > now();
$$;

/** Records one attempt atomically; returns the lock end time if now locked. */
CREATE FUNCTION public.tracker_record_attempt(p_tracker uuid, p_visitor text, p_success boolean)
RETURNS timestamptz LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  result timestamptz;
BEGIN
  IF p_success THEN
    DELETE FROM public.tracker_unlock_attempts WHERE tracker_id = p_tracker AND visitor_key = p_visitor;
    RETURN NULL;
  END IF;
  INSERT INTO public.tracker_unlock_attempts AS a (tracker_id, visitor_key, failures)
  VALUES (p_tracker, p_visitor, 1)
  ON CONFLICT (tracker_id, visitor_key) DO UPDATE SET
    -- A finished lock starts a fresh count of five.
    failures = CASE WHEN a.locked_until IS NOT NULL AND a.locked_until <= now() THEN 1 ELSE a.failures + 1 END,
    locked_until = CASE WHEN a.locked_until IS NOT NULL AND a.locked_until <= now() THEN NULL ELSE a.locked_until END,
    updated_at = now();
  UPDATE public.tracker_unlock_attempts
    SET locked_until = now() + interval '15 minutes'
    WHERE tracker_id = p_tracker AND visitor_key = p_visitor AND failures >= 5 AND locked_until IS NULL
    RETURNING locked_until INTO result;
  RETURN result;
END;
$$;

-- Saved packages (e.g. "Premium author package") so new trackers start with the right items.
CREATE TABLE public.tracker_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  package_name text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_templates_expert_idx ON public.tracker_templates (expert_id);

-- Server-only tables: the browser never talks to them directly.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_trackers','tracker_items','tracker_files','tracker_log_entries',
    'tracker_view_events','tracker_unlock_attempts','tracker_templates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.tracker_lock_until(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tracker_record_attempt(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_lock_until(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tracker_record_attempt(uuid, text, boolean) TO service_role;

-- Private bucket: files leave only through short lived signed links.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('tracker-files', 'tracker-files', false, 209715200)
    ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;
END $$;

-- Academy content records (feature A): chapters, niche guides, daily lessons
-- and SVG diagrams, edited by trainers without a developer. Every change is
-- kept in academy_content_versions with the editor and date.
CREATE TABLE public.academy_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('chapter', 'niche_guide', 'daily_lesson', 'diagram')),
  playbook text NOT NULL DEFAULT 'business' CHECK (playbook IN ('author', 'business')),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120),
  number integer,
  part text NOT NULL DEFAULT '' CHECK (char_length(part) <= 80),
  -- Niche guides: one of five filter groups. Daily lessons: the category label.
  group_name text NOT NULL DEFAULT '' CHECK (char_length(group_name) <= 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  -- Light markdown (see src/lib/academy/content.ts); "> copy:" lines get a Copy button.
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 60000),
  -- Structured niche guide fields: pitch, where, contact, countries, watch_outs, first_message.
  fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fields) = 'object'),
  -- Diagrams only. Rendered through <img>, so no script inside can run.
  svg text CHECK (svg IS NULL OR (char_length(svg) <= 200000 AND svg ~* '^\s*(<\?xml[^>]*>\s*)?<svg[\s>]')),
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  -- Drives the 7 day New badge and the Today's lesson strip.
  published_at timestamptz,
  lesson_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system' CHECK (char_length(updated_by) <= 200),
  CHECK (kind <> 'diagram' OR svg IS NOT NULL)
);
CREATE INDEX academy_content_list_idx ON public.academy_content (playbook, kind, sort_order, number);

CREATE TABLE public.academy_content_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id uuid NOT NULL REFERENCES public.academy_content(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  editor text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, version)
);

CREATE FUNCTION public.academy_content_keep_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.published AND NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER academy_content_touch BEFORE INSERT OR UPDATE ON public.academy_content
FOR EACH ROW EXECUTE FUNCTION public.academy_content_keep_version();

CREATE FUNCTION public.academy_content_record_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.academy_content_versions (content_id, version, snapshot, editor)
  VALUES (
    NEW.id,
    COALESCE((SELECT max(version) FROM public.academy_content_versions WHERE content_id = NEW.id), 0) + 1,
    to_jsonb(NEW) - 'id',
    NEW.updated_by
  );
  RETURN NULL;
END;
$$;
CREATE TRIGGER academy_content_versioned AFTER INSERT OR UPDATE ON public.academy_content
FOR EACH ROW EXECUTE FUNCTION public.academy_content_record_version();

ALTER TABLE public.academy_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_content_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_content, public.academy_content_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_content TO service_role;
GRANT SELECT, INSERT ON public.academy_content_versions TO service_role;
