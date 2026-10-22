-- Admin gets every client tracker feature experts have. Admin has no expert
-- profile, so the rows admin owns or acts on carry admin markers instead.

-- Templates with no expert belong to admin.
ALTER TABLE public.tracker_templates ALTER COLUMN expert_id DROP NOT NULL;

-- Admin's own AI key: same encryption, its own row, never an expert's key.
CREATE TABLE public.admin_ai_credentials (
  id text PRIMARY KEY DEFAULT 'admin' CHECK (id = 'admin'),
  provider text NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
  encrypted_key text NOT NULL CHECK (encrypted_key ~ '^v1\.'),
  last_four text NOT NULL CHECK (char_length(last_four) = 4),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_ai_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_ai_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ai_credentials TO service_role;

-- Usage rows from admin have no expert.
ALTER TABLE public.expert_ai_usage ALTER COLUMN expert_id DROP NOT NULL;
ALTER TABLE public.expert_ai_usage
  ADD COLUMN actor text NOT NULL DEFAULT 'expert' CHECK (actor IN ('expert', 'admin')),
  ADD CONSTRAINT expert_ai_usage_owner CHECK ((actor = 'admin') = (expert_id IS NULL));

-- A draft approved by admin records that instead of an expert id.
ALTER TABLE public.tracker_ai_drafts
  ADD COLUMN created_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_by_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.tracker_ai_drafts DROP CONSTRAINT IF EXISTS tracker_ai_drafts_check;
ALTER TABLE public.tracker_ai_drafts ADD CONSTRAINT tracker_ai_drafts_approval_recorded CHECK (
  (status = 'approved') = (approved_at IS NOT NULL AND (approved_by IS NOT NULL OR approved_by_admin))
);
