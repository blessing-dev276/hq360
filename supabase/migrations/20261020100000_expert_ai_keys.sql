-- Bring your own key AI updates (spec feature C 4.2). One key per expert,
-- AES-256-GCM encrypted by the server; only the last four characters are
-- ever shown again. AI output lands in tracker_ai_drafts and nowhere else:
-- a person must approve a draft before it changes what the client can see.

CREATE TABLE public.expert_ai_credentials (
  expert_id uuid PRIMARY KEY REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
  -- v1.<iv>.<tag>.<ciphertext>, bound to the expert id (see src/lib/trackers/ai-keys.server.ts).
  encrypted_key text NOT NULL CHECK (encrypted_key ~ '^v1\.'),
  last_four text NOT NULL CHECK (char_length(last_four) = 4),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.expert_ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expert_id uuid NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  tracker_id uuid REFERENCES public.client_trackers(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('draft_update', 'friendly_rewrite', 'progress_summary', 'portfolio_blurb')),
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_ai_usage_expert_idx ON public.expert_ai_usage (expert_id, created_at DESC);

CREATE TABLE public.tracker_ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.tracker_items(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('draft_update', 'friendly_rewrite', 'progress_summary', 'portfolio_blurb')),
  input text NOT NULL CHECK (char_length(input) <= 8000),
  -- { log_entry?, description?, text? } exactly as the model returned it, after checks.
  output jsonb NOT NULL CHECK (jsonb_typeof(output) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'discarded')),
  created_by uuid REFERENCES public.expert_profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.expert_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'approved') = (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX tracker_ai_drafts_tracker_idx ON public.tracker_ai_drafts (tracker_id, created_at DESC);

ALTER TABLE public.expert_ai_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_ai_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expert_ai_credentials, public.expert_ai_usage, public.tracker_ai_drafts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_ai_credentials, public.tracker_ai_drafts TO service_role;
GRANT SELECT, INSERT ON public.expert_ai_usage TO service_role;
