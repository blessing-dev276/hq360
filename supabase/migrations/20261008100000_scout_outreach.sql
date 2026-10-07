CREATE TABLE public.scout_outreach_settings (
  owner text PRIMARY KEY,
  prompt text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scout_author_message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL,
  author_id uuid NOT NULL REFERENCES public.scout_authors(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.scout_discovered_books(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scout_outreach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_author_message_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scout_outreach_settings, public.scout_author_message_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_outreach_settings, public.scout_author_message_drafts TO service_role;
CREATE INDEX scout_author_message_drafts_owner_author ON public.scout_author_message_drafts(owner, author_id, created_at DESC);
