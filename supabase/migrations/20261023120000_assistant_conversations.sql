-- AI Assistant chat history: one row per conversation, owned by the admin
-- workspace ('admin') or one expert (their expert id). Server-only access.
CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY,
  owner text NOT NULL CHECK (char_length(owner) BETWEEN 1 AND 64),
  title text NOT NULL DEFAULT 'New chat' CHECK (char_length(title) BETWEEN 1 AND 120),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_conversations_owner_idx
  ON public.assistant_conversations (owner, updated_at DESC);
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO service_role;
