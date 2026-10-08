-- Practice progress: when a chat ended (streaks, daily missions), chats the
-- trainee walked away from (auto-scored), and notes from their trainer.
ALTER TABLE public.sessions
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN abandoned boolean NOT NULL DEFAULT false,
  ADD COLUMN trainer_feedback jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(trainer_feedback) = 'array'),
  ADD COLUMN feedback_unread boolean NOT NULL DEFAULT false;
UPDATE public.sessions SET ended_at = updated_at WHERE ended AND ended_at IS NULL;
CREATE INDEX sessions_user_ended_idx ON public.sessions (user_id, ended_at DESC);
