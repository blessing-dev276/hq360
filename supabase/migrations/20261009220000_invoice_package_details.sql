-- Invoices show a title, the package name and what's included (also carried
-- on expert invoice requests, e.g. ones created from a quote).
alter table public.payment_invoices
  add column title text not null default '' check (char_length(title) <= 200),
  add column package_name text not null default '' check (char_length(package_name) <= 160),
  add column included text[] not null default '{}' check (cardinality(included) <= 30);
alter table public.expert_invoice_requests
  add column title text not null default '' check (char_length(title) <= 200),
  add column package_name text not null default '' check (char_length(package_name) <= 160),
  add column included text[] not null default '{}' check (cardinality(included) <= 30);
