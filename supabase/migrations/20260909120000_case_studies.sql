-- Case studies / project write-ups shown on /work and /work/:slug, managed from /admin.
-- Rich content: string arrays for approach/deliverables/capabilities, JSON arrays
-- for metrics and media, an optional JSON testimonial. Ordered by sort_order.

CREATE TABLE public.case_studies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- URL slug, unique. Used as /work/:slug.
  slug TEXT NOT NULL UNIQUE,
  -- 'verified' (a real project) | 'sample' (illustrative engagement shape).
  status TEXT NOT NULL DEFAULT 'sample',
  title TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  -- Industry short name (free text, matches src/data/industries.ts shortName).
  industry TEXT NOT NULL DEFAULT '',
  -- Capability slugs (see src/data/capabilities.ts).
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  challenge TEXT NOT NULL DEFAULT '',
  approach TEXT[] NOT NULL DEFAULT '{}',
  deliverables TEXT[] NOT NULL DEFAULT '{}',
  outcome TEXT NOT NULL DEFAULT '',
  -- [{ label, value, note? }]
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- { quote, name, role } | null
  testimonial JSONB,
  -- [{ src, alt, caption?, type? }]  type: 'image' | 'video'
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX case_studies_order_idx ON public.case_studies (sort_order, created_at);
CREATE INDEX case_studies_slug_idx ON public.case_studies (slug);

GRANT ALL ON public.case_studies TO service_role;
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;
-- No policies: all reads and writes go through server routes using the service role.

CREATE OR REPLACE FUNCTION public.case_studies_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_studies_updated_at
  BEFORE UPDATE ON public.case_studies
  FOR EACH ROW EXECUTE FUNCTION public.case_studies_touch_updated_at();

-- Storage bucket for case-study images / video (public read).
INSERT INTO storage.buckets (id, name, public)
VALUES ('work', 'work', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "work public read" ON storage.objects;
CREATE POLICY "work public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'work');

-- Seed the current static case studies (text only; media is re-added from /admin
-- because the launch gallery currently lives in the app bundle, not storage).
INSERT INTO public.case_studies
  (slug, status, title, client, industry, capabilities, summary, challenge, approach, deliverables, outcome, sort_order)
VALUES
  (
    'sanman-thapa-book-launch', 'verified',
    'A live launch day for a debut novella',
    'Sanman Thapa — From the Window: The City of What Ifs',
    'Authors & Publishers',
    ARRAY['visibility-reputation','brand-creative','websites-funnels'],
    'A launch built around signed copies, a full room and a cover-reveal film, delivered with Arti Facts Publishing.',
    'A debut author with two titles to bring to market and one launch day to make them land in front of real readers.',
    ARRAY[
      'Planned the launch day end to end: venue, signing table, guest list and run of show.',
      'Produced a cover-reveal film and a set of covers and print assets for the event and for retail.',
      'Ran the on-the-day capture — photography and video — for use across the author''s platform afterward.'
    ],
    ARRAY[
      'Cover-reveal film',
      'Front and back cover and print assets',
      'Launch-day photography and video library',
      'Event plan and run of show'
    ],
    'A sold-through signing table, a full room and two titles in print. Event photography and the reveal film continue to serve the author''s platform.',
    0
  ),
  (
    'real-estate-team-follow-up-system', 'sample',
    'A follow-up system for a mid-size real estate team',
    'Illustrative engagement',
    'Real Estate',
    ARRAY['crm-automation','lead-generation','websites-funnels'],
    'How HQ360 structures a real estate growth engagement — from landing pages to CRM to database reactivation.',
    'Portal and ad leads arriving faster than the team could call, follow-up stopping after two attempts, and thousands of old leads untouched in the CRM.',
    ARRAY[
      'Built seller and buyer landing pages connected to a GoHighLevel pipeline.',
      'Added speed-to-lead SMS and call routing so every lead is contacted within minutes.',
      'Wrote a months-long nurture sequence and a structured database reactivation campaign.'
    ],
    ARRAY[
      'Seller and buyer landing pages',
      'GoHighLevel CRM and pipeline setup',
      'Speed-to-lead and long-nurture automations',
      'Database reactivation campaign',
      'Weekly reporting dashboard'
    ],
    'The engagement is structured to increase contact rate on new leads and to generate appointments from the existing database. Illustrative — not a report of a specific client''s results.',
    1
  ),
  (
    'home-services-booking-engine', 'sample',
    'A booking engine for a multi-trade home service company',
    'Illustrative engagement',
    'Home Services',
    ARRAY['websites-funnels','lead-generation','visibility-reputation','crm-automation'],
    'How HQ360 assembles a home services lead-to-booked-job system across site, ads, response and reviews.',
    'A company dependent on a single lead-selling directory, with slow response times and a review profile that did not reflect the quality of the work.',
    ARRAY[
      'Rebuilt the site with call and book actions above the fold on every service page.',
      'Launched Google and Meta campaigns and optimised the Google Business Profile for the map pack.',
      'Set up speed-to-lead texting, estimate follow-up and post-job review requests.'
    ],
    ARRAY[
      'Service-area website',
      'Local ad campaigns',
      'Google Business Profile optimisation',
      'Speed-to-lead and estimate follow-up automation',
      'Review generation system'
    ],
    'The system is built to reduce reliance on bought leads and to raise the share of estimates that convert. Illustrative — not a report of a specific client''s results.',
    2
  ),
  (
    'coach-application-funnel', 'sample',
    'An application funnel for a high-ticket consultant',
    'Illustrative engagement',
    'Coaches & Consultants',
    ARRAY['websites-funnels','lead-generation','crm-automation','brand-creative'],
    'How HQ360 turns a referral-only consulting practice into a system that books qualified calls.',
    'A practice built on word of mouth that had plateaued, with a calendar filling with unqualified discovery calls.',
    ARRAY[
      'Sharpened positioning to one audience and one outcome, then rebuilt the offer pages.',
      'Built an application funnel that qualifies on budget, readiness and fit before a call is booked.',
      'Added paid traffic and a pre-call show-up sequence.'
    ],
    ARRAY[
      'Positioning and offer pages',
      'Application and qualification funnel',
      'Paid campaign setup',
      'Show-up and evergreen nurture sequences'
    ],
    'The funnel is designed to reduce time spent on unqualified calls and to add a channel beyond referrals. Illustrative — not a report of a specific client''s results.',
    3
  );
