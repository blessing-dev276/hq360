-- New leads no longer raise an admin notification (bell or email); they
-- simply appear in Leads & Projects. Other notifications are unchanged.
drop trigger if exists notify_sales_leads on public.sales_leads;
drop function if exists public.notify_sales_leads();

-- Clear the "New lead" items already in the admin bell.
delete from public.notifications where audience = 'admin' and kind = 'new_lead';
