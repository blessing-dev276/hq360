-- Rule based Author Engine: replaces every AI call in the practice room.

ALTER TABLE public.sessions
  ADD COLUMN trust INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN stage TEXT NOT NULL DEFAULT 'Cold',
  ADD COLUMN objection_revealed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN used_line_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- One entry per scout message: signals, trust change, reaction chosen.
  ADD COLUMN signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN trust_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.response_bank (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  author TEXT NOT NULL, -- author name, or 'ANY'
  reaction TEXT NOT NULL,
  text TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX response_bank_lookup_idx ON public.response_bank (author, reaction) WHERE active;

CREATE TABLE public.hints (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE public.feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  signal TEXT NOT NULL,
  -- 'worked' and 'change' feed the coaching lists; 'summary' holds the outcome sentences.
  kind TEXT NOT NULL CHECK (kind IN ('worked', 'change', 'summary')),
  text TEXT NOT NULL
);

CREATE TABLE public.model_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  author TEXT NOT NULL,
  reaction TEXT NOT NULL,
  text TEXT NOT NULL
);

-- Every time the engine runs out of unused lines for an author and reaction.
CREATE TABLE public.weak_spots (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT REFERENCES public.sessions (id) ON DELETE CASCADE,
  scout_text TEXT,
  reaction_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.response_bank, public.hints, public.feedback, public.model_lines, public.weak_spots
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.weak_spots_id_seq TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.response_bank, public.hints, public.feedback,
  public.model_lines TO authenticated;
GRANT SELECT ON public.weak_spots TO authenticated;

ALTER TABLE public.response_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weak_spots ENABLE ROW LEVEL SECURITY;

-- Trainer only. Trainees cannot read any of these tables.
CREATE POLICY "response_bank trainer" ON public.response_bank
  FOR ALL TO authenticated USING (public.is_trainer()) WITH CHECK (public.is_trainer());
CREATE POLICY "hints trainer" ON public.hints
  FOR ALL TO authenticated USING (public.is_trainer()) WITH CHECK (public.is_trainer());
CREATE POLICY "feedback trainer" ON public.feedback
  FOR ALL TO authenticated USING (public.is_trainer()) WITH CHECK (public.is_trainer());
CREATE POLICY "model_lines trainer" ON public.model_lines
  FOR ALL TO authenticated USING (public.is_trainer()) WITH CHECK (public.is_trainer());
CREATE POLICY "weak_spots trainer read" ON public.weak_spots
  FOR SELECT TO authenticated USING (public.is_trainer());

-- Trainees must not be able to read or edit engine state on their own sessions
-- directly; all engine writes go through the server.
REVOKE UPDATE ON public.sessions FROM authenticated;
-- Hidden fields (persona secret is server side; mood, test style, trust, strikes)
-- must not be readable straight from Supabase either.
REVOKE SELECT ON public.sessions FROM authenticated;
GRANT SELECT (id, user_id, persona, mode, messages, ended, created_at, updated_at)
  ON public.sessions TO authenticated;
