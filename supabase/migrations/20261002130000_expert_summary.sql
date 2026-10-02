-- A short one-to-two-line intro for the public profile hero, kept separate
-- from the longer bio shown further down the page.
alter table public.expert_profiles
  add column summary text check (char_length(summary) <= 140);
