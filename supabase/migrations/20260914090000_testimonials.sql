-- Testimonials (review screenshots) — distinct from portfolio_items (work
-- samples / case studies). Managed from /admin > Testimonials. Optionally
-- scoped to an industry and/or a service (capability), same tagging pattern
-- as the portfolio, but a separate table because a testimonial is proof of
-- reputation, not a piece of delivered work.

CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- e.g. "sanman_thapa, five star review"
  title TEXT NOT NULL,
  -- Optional short excerpt/context shown under the screenshot.
  quote TEXT,
  -- Supabase Storage public URL or an external URL.
  media_url TEXT NOT NULL,
  -- Which industry page shows this testimonial. NULL = shown everywhere.
  industry_slug TEXT,
  -- Which service it backs up. NULL = general.
  capability_slug TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX testimonials_order_idx ON public.testimonials (sort_order, created_at);
CREATE INDEX testimonials_industry_idx ON public.testimonials (industry_slug);
CREATE INDEX testimonials_capability_idx ON public.testimonials (capability_slug);

GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
-- No policies: all reads and writes go through server routes using the service role.

CREATE OR REPLACE FUNCTION public.testimonials_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.testimonials_touch_updated_at();

-- Storage bucket for uploaded testimonial screenshots (public read).
INSERT INTO storage.buckets (id, name, public)
VALUES ('testimonials', 'testimonials', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "testimonials public read" ON storage.objects;
CREATE POLICY "testimonials public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonials');
