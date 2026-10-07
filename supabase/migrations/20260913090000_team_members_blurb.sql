-- Add an editable "what they do" line, shown on the flip side of each team
-- card on the homepage and About page. Admin-editable from /admin > Team.

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS blurb TEXT;

-- Seed the existing six rows with the real copy that was previously
-- hardcoded in the frontend, so nothing regresses for the current team.
UPDATE public.team_members SET blurb = CASE name
  WHEN 'Blessing' THEN 'Runs the studio and leads native app builds — the product end of a growth system.'
  WHEN 'Richard'  THEN 'Owns paid and lifecycle — the path from spend to qualified pipeline.'
  WHEN 'Zainab'   THEN 'Turns strategy into video and AI-assisted creative at production pace.'
  WHEN 'Ebenezer' THEN 'Sets positioning and identity so everything downstream reads as one brand.'
  WHEN 'Emmanuel' THEN 'Builds the sites and funnels where attention turns into a booked conversation.'
  WHEN 'Racheal'  THEN 'Keeps the brand present and consistent across social, day to day.'
  ELSE blurb
END
WHERE blurb IS NULL;
