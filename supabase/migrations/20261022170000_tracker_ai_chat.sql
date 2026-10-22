CREATE TABLE public.tracker_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid NOT NULL REFERENCES public.client_trackers(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_ai_messages_history_idx ON public.tracker_ai_messages (tracker_id, conversation_id, created_at);
ALTER TABLE public.tracker_ai_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracker_ai_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.tracker_ai_messages TO service_role;
