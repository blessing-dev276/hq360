-- Testimonials: support video testimonials alongside screenshot testimonials,
-- same media_type / thumbnail_url pattern already used by portfolio_items.

ALTER TABLE public.testimonials
  ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN thumbnail_url TEXT;

ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_media_type_check CHECK (media_type IN ('image', 'video'));
