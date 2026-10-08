-- Academy trainers' own Perplexity keys (encrypted server side). The Practice
-- Room AI uses the trainer's key; browsers never read this table.
CREATE TABLE public.academy_trainer_credentials (
  trainer_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  encrypted_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_trainer_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_trainer_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_trainer_credentials TO service_role;
