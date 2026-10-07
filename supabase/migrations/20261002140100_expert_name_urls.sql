-- Name-only canonical profile URLs, with old URLs retained as aliases.
create table public.expert_slug_aliases (
 slug text primary key,
 expert_id uuid not null references public.expert_profiles(id) on delete cascade
);
create index expert_slug_aliases_expert_id_idx on public.expert_slug_aliases(expert_id);
alter table public.expert_slug_aliases enable row level security;
revoke all on public.expert_slug_aliases from anon, authenticated;
grant all on public.expert_slug_aliases to service_role;

create or replace function public.expert_slug(p_name text, p_id uuid)
returns text language plpgsql volatile security definer set search_path=public as $$
declare
 base text := coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(p_name,'')), '[^a-z0-9]+','-','g')),''),'expert');
 candidate text := base;
 suffix text;
 counter integer := 0;
 value integer;
begin
 -- Serialize allocation so concurrent signups cannot claim the same URL.
 perform pg_advisory_xact_lock(728431905);
 while exists(select 1 from expert_profiles where slug=candidate and id<>p_id)
    or exists(select 1 from expert_slug_aliases where slug=candidate and expert_id<>p_id) loop
   counter := counter+1;
   if counter=1 then candidate:=base||'-expert';
   else
     value:=counter-1; suffix:='';
     while value>0 loop
       value:=value-1;
       suffix:=chr(97+(value%26))||suffix;
       value:=value/26;
     end loop;
     candidate:=base||'-expert-'||suffix;
   end if;
 end loop;
 return candidate;
end $$;
revoke all on function public.expert_slug(text,uuid) from public,anon,authenticated;
grant execute on function public.expert_slug(text,uuid) to service_role;

create function public.assign_expert_name_slug()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.slug:=public.expert_slug(new.full_name,new.id);
 return new;
end $$;
create trigger expert_name_slug before insert or update of full_name,slug on public.expert_profiles
for each row execute function public.assign_expert_name_slug();

create function public.remember_expert_slug()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.slug is distinct from new.slug then
   insert into expert_slug_aliases(slug,expert_id) values(old.slug,new.id) on conflict(slug) do nothing;
 end if;
 return new;
end $$;
create trigger expert_slug_history after update of slug,full_name on public.expert_profiles
for each row execute function public.remember_expert_slug();

-- Preserve every existing link before updating each profile deterministically.
do $$
declare profile record;
begin
 for profile in select id,full_name from public.expert_profiles order by created_at,id loop
   update public.expert_profiles set slug=public.expert_slug(profile.full_name,profile.id) where id=profile.id;
 end loop;
end $$;
