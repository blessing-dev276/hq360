-- Admin can make an expert an Author Scout Academy trainer. Their expert
-- profile (name, photo, headline) is shown as the trainer, and their own
-- Perplexity key powers the Practice Room AI.
alter table public.expert_profiles
  add column academy_trainer boolean not null default false;
