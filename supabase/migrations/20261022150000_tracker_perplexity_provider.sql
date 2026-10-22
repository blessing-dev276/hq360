-- Perplexity is a first-class provider for tracker AI.
ALTER TABLE public.expert_ai_credentials DROP CONSTRAINT IF EXISTS expert_ai_credentials_provider_check;
ALTER TABLE public.expert_ai_credentials ADD CONSTRAINT expert_ai_credentials_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'perplexity'));
ALTER TABLE public.admin_ai_credentials DROP CONSTRAINT IF EXISTS admin_ai_credentials_provider_check;
ALTER TABLE public.admin_ai_credentials ADD CONSTRAINT admin_ai_credentials_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'perplexity'));
