-- Admin control of the Academy: AI settings and a full log of AI usage.

-- Every Practice Room AI call: who, with whose key, which model, the result.
ALTER TABLE public.usage_log
  ADD COLUMN outcome text NOT NULL DEFAULT 'ai'
    CHECK (outcome IN ('ai', 'fallback', 'off', 'limit', 'no_key')),
  ADD COLUMN model text,
  ADD COLUMN key_owner uuid,
  ADD COLUMN latency_ms integer,
  ADD COLUMN error text;
CREATE INDEX usage_log_created_idx ON public.usage_log (created_at DESC);

-- One row of Academy settings, managed from Admin → Academy → Settings.
CREATE TABLE public.academy_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_reply boolean NOT NULL DEFAULT true,
  ai_hint boolean NOT NULL DEFAULT true,
  ai_coach boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'openai/gpt-6-luna' CHECK (char_length(model) BETWEEN 3 AND 100),
  -- AI calls one person may use per day; 0 = unlimited.
  daily_ai_limit integer NOT NULL DEFAULT 200 CHECK (daily_ai_limit BETWEEN 0 AND 100000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.academy_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.academy_settings TO service_role;
