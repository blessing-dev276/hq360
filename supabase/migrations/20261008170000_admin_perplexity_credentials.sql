-- Shared admin credential, inaccessible to browser clients and expert accounts.
CREATE TABLE public.admin_perplexity_credentials (
  id text PRIMARY KEY CHECK (id = 'admin'),
  encrypted_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_perplexity_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_perplexity_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_perplexity_credentials TO service_role;
