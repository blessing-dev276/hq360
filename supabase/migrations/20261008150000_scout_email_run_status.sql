ALTER TABLE public.scout_email_runs ADD COLUMN status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','stopped'));
ALTER TABLE public.scout_email_runs ADD COLUMN finished_at timestamptz;
