-- Team members shown on /about, managed from /admin.
-- Each row is a person (name + title), an optional portrait image, an ordered
-- position (sort_order) and a published flag.

CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  -- Supabase Storage public URL or an external URL. NULL = show initials.
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX team_members_order_idx ON public.team_members (sort_order, created_at);

GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
-- No policies: all reads and writes go through server routes using the service role.

CREATE OR REPLACE FUNCTION public.team_members_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.team_members_touch_updated_at();

-- Storage bucket for uploaded portraits (public read).
INSERT INTO storage.buckets (id, name, public)
VALUES ('team', 'team', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "team public read" ON storage.objects;
CREATE POLICY "team public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team');

-- Seed the current team. Portraits stay NULL: the public page falls back to the
-- bundled photos by name until an admin uploads replacements.
INSERT INTO public.team_members (name, title, sort_order) VALUES
  ('Blessing', 'CEO & Mobile App Developer', 0),
  ('Richard',  'Digital Marketing Lead',        1),
  ('Zainab',   'AI & Video Production Lead',      2),
  ('Ebenezer', 'Brand & Creative Lead', 3),
  ('Emmanuel', 'Web & Funnel Development Lead',  4),
  ('Racheal',  'Social Media Manager',        5);
