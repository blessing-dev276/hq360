-- In-app notifications for the admin and expert workspaces.
--
-- Every event is raised by a trigger on the table that changed, so a
-- notification is written no matter which route, webhook or admin action
-- caused it. Rows are only read and updated through server routes using the
-- service role; RLS stays closed to anon/authenticated clients.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 'admin' notifies the HQ360 team; 'expert' notifies one expert (expert_id).
  audience text not null check (audience in ('admin', 'expert')),
  expert_id uuid references public.expert_profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  -- Workspace tab to open when clicked, e.g. 'payments' or 'invoices'.
  tab text,
  read_at timestamptz,
  check ((audience = 'expert') = (expert_id is not null))
);
alter table public.notifications enable row level security;
create index notifications_admin_idx on public.notifications (created_at desc)
  where audience = 'admin';
create index notifications_expert_idx on public.notifications (expert_id, created_at desc);

create or replace function public.hq_notify(
  p_audience text, p_expert uuid, p_kind text, p_title text, p_body text, p_tab text
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (audience, expert_id, kind, title, body, tab)
  values (p_audience, p_expert, p_kind, p_title, coalesce(p_body, ''), p_tab);
$$;
revoke all on function public.hq_notify(text, uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.fmt_money(amount_minor bigint, currency text)
returns text language sql immutable as $$
  select coalesce(upper(currency), 'USD') || ' ' || to_char(amount_minor / 100.0, 'FM999,999,990.00');
$$;

-- Expert accounts: signup, approval decision, profile review.
create or replace function public.notify_expert_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text := coalesce(nullif(new.full_name, ''), new.email);
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform hq_notify('admin', null, 'expert_signup', 'New expert signup',
        who || ' is waiting for approval.', 'experts');
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform hq_notify('expert', new.id, 'expert_' || new.status,
      case new.status when 'approved' then 'Your expert account is approved'
        else 'Your expert application was not approved' end,
      case new.status when 'approved' then 'You now have access to your HQ360 expert workspace.'
        else 'Contact HQ360 if you have questions about this decision.' end,
      'profile');
  end if;
  if new.profile_status is distinct from old.profile_status then
    if new.profile_status = 'submitted' then
      perform hq_notify('admin', null, 'profile_submitted', 'Expert profile submitted',
        who || ' submitted their public profile for review.', 'experts');
    elsif new.profile_status = 'changes_requested' then
      perform hq_notify('expert', new.id, 'profile_changes', 'Changes requested on your profile',
        coalesce(nullif(new.profile_review_note, ''), 'Update your profile and submit it again.'),
        'profile');
    end if;
  end if;
  if new.is_public and not coalesce(old.is_public, false) then
    perform hq_notify('expert', new.id, 'profile_live', 'Your profile is live',
      'Your public expert profile is now visible on hq360.space.', 'profile');
  end if;
  return new;
end $$;
create trigger notify_expert_profiles
  after insert or update on public.expert_profiles
  for each row execute function public.notify_expert_profiles();

-- Expert portfolio items: submitted for review, approved / rejected.
create or replace function public.notify_expert_portfolio() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      select coalesce(nullif(full_name, ''), email) into who
        from expert_profiles where id = new.expert_id;
      perform hq_notify('admin', null, 'portfolio_submitted', 'Portfolio item to review',
        coalesce(who, 'An expert') || ' submitted "' || new.title || '".', 'experts');
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform hq_notify('expert', new.expert_id, 'portfolio_' || new.status,
      'Portfolio item ' || new.status,
      '"' || new.title || '" was ' || new.status || '.', 'profile');
  end if;
  return new;
end $$;
create trigger notify_expert_portfolio
  after insert or update on public.expert_portfolio_items
  for each row execute function public.notify_expert_portfolio();

-- Expert invoice requests: new request, fulfilled / declined.
create or replace function public.notify_invoice_requests() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(full_name, ''), email) into who
      from expert_profiles where id = new.expert_id;
    perform hq_notify('admin', null, 'invoice_request', 'New invoice request',
      coalesce(who, 'An expert') || ' requested an invoice for ' || new.buyer_name || ' · '
        || fmt_money(new.amount_minor, 'USD') || '.', 'payments');
  elsif new.status is distinct from old.status then
    if new.status = 'fulfilled' then
      perform hq_notify('expert', new.expert_id, 'invoice_request_fulfilled', 'Invoice created',
        'Your invoice for ' || new.buyer_name || ' is being prepared. Copy the link once it''s issued.',
        'invoices');
    elsif new.status = 'declined' then
      perform hq_notify('expert', new.expert_id, 'invoice_request_declined', 'Invoice request declined',
        coalesce(nullif(new.admin_note, ''), 'Your request for ' || new.buyer_name || ' was declined.'),
        'invoices');
    end if;
  end if;
  return new;
end $$;
create trigger notify_invoice_requests
  after insert or update on public.expert_invoice_requests
  for each row execute function public.notify_invoice_requests();

-- Invoices: issued (link ready for the requesting expert) and paid.
create or replace function public.notify_payment_invoices() returns trigger
language plpgsql security definer set search_path = public as $$
declare expert uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select expert_id into expert from expert_invoice_requests where invoice_id = new.id limit 1;
  if new.status = 'pending' and old.status = 'draft' and expert is not null then
    perform hq_notify('expert', expert, 'invoice_issued', 'Invoice link ready',
      new.number || ' for ' || new.buyer_name || ' is ready. Copy the link and send it to your client.',
      'invoices');
  elsif new.status = 'paid' then
    perform hq_notify('admin', null, 'invoice_paid', 'Payment received',
      new.number || ' · ' || new.buyer_name || ' paid ' || fmt_money(new.amount_minor, new.currency)
        || case when new.environment = 'demo' then ' (test)' else '' end || '.', 'payments');
    if expert is not null then
      perform hq_notify('expert', expert, 'invoice_paid', 'Your client paid',
        new.buyer_name || ' paid ' || new.number || ' · ' || fmt_money(new.amount_minor, new.currency) || '.',
        'invoices');
    end if;
  end if;
  return new;
end $$;
create trigger notify_payment_invoices
  after update on public.payment_invoices
  for each row execute function public.notify_payment_invoices();

-- Sales leads arriving from the website (inquiries, visibility checks, Scout).
create or replace function public.notify_sales_leads() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source_kind <> 'manual' then
    perform hq_notify('admin', null, 'new_lead', 'New lead',
      new.name || case new.source_kind
        when 'inquiry' then ' sent an inquiry.'
        when 'visibility_check' then ' requested a visibility check.'
        else ' was saved from Scout.' end, 'projects');
  end if;
  return new;
end $$;
create trigger notify_sales_leads
  after insert on public.sales_leads
  for each row execute function public.notify_sales_leads();

-- Author audits waiting on a reviewer.
create or replace function public.notify_author_audits() returns trigger
language plpgsql security definer set search_path = public as $$
declare author text;
begin
  if new.status = 'ready_for_review' and new.status is distinct from old.status then
    select name into author from authors where id = new.author_id;
    perform hq_notify('admin', null, 'audit_review', 'Audit ready for review',
      coalesce(author, 'An author') || '''s audit is ready for review.', 'audits');
  end if;
  return new;
end $$;
create trigger notify_author_audits
  after update on public.author_audits
  for each row execute function public.notify_author_audits();
