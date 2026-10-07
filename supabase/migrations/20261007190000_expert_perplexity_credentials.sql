-- Server-managed provider credentials, deliberately separate from public profiles.
CREATE TABLE public.expert_perplexity_credentials (
  expert_id uuid PRIMARY KEY REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  encrypted_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expert_perplexity_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expert_perplexity_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_perplexity_credentials TO service_role;
