-- Allow admins to grant experts the Quotes tool (keep in sync with EXPERT_FEATURES).
alter table public.expert_profiles drop constraint if exists expert_profiles_permissions_check;
alter table public.expert_profiles add constraint expert_profiles_permissions_check
  check (permissions <@ array['scout', 'audit', 'invoices', 'contacts', 'quotes']::text[]);
