create extension if not exists pg_trgm with schema extensions;

create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  slot text not null check (slot in ('hero','scrolling','flash','sidebar')),
  image_url text not null,
  destination_url text,
  alt_text text not null,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (image_url ~ '^https://')
);

create index if not exists advertisements_public_idx
  on public.advertisements(slot,status,sort_order,starts_at,ends_at);
create index if not exists properties_public_location_search_idx
  on public.properties using gin ((locality_text || ' ' || city_text || ' ' || district_text) extensions.gin_trgm_ops)
  where status='published' and deleted_at is null;
create index if not exists properties_public_title_search_idx
  on public.properties using gin (title extensions.gin_trgm_ops)
  where status='published' and deleted_at is null;
create index if not exists locations_public_name_search_idx
  on public.locations using gin (name extensions.gin_trgm_ops)
  where is_active and deleted_at is null;

alter table public.advertisements enable row level security;
drop policy if exists advertisements_public_read on public.advertisements;
create policy advertisements_public_read on public.advertisements for select
using (
  (status='approved' and coalesce(starts_at,'-infinity'::timestamptz) <= now()
    and coalesce(ends_at,'infinity'::timestamptz) > now())
  or public.has_permission('settings.manage')
);
drop policy if exists advertisements_admin_manage on public.advertisements;
create policy advertisements_admin_manage on public.advertisements for all
using (public.has_permission('settings.manage'))
with check (public.has_permission('settings.manage'));
grant select on public.advertisements to anon,authenticated;
grant insert,update,delete on public.advertisements to authenticated;

drop trigger if exists advertisements_updated on public.advertisements;
create trigger advertisements_updated before update on public.advertisements
for each row execute function public.set_updated_at();

revoke insert on public.analytics_events from anon,authenticated;

insert into public.locations(type,name,slug,is_active,sort_order)
select v.type,v.name,v.slug,true,v.sort_order
from (values
  ('locality','Bhagya Nagar','bhagya-nagar',10),
  ('locality','Bhagyanagar','bhagyanagar',11),
  ('locality','Gopal Nagar','gopal-nagar',20),
  ('locality','Pernamitta','pernamitta',30),
  ('locality','Lawyer Pet','lawyer-pet',40),
  ('locality','Mangamuru Road','mangamuru-road',50),
  ('locality','Kurnool Road','kurnool-road',60),
  ('locality','Pelluru','pelluru',70)
) as v(type,name,slug,sort_order)
where not exists (select 1 from public.locations l where l.slug=v.slug and l.deleted_at is null);

update public.master_items set is_active=false,deleted_at=coalesce(deleted_at,now()) where kind='advertisement_type' and slug='footer-banner';
insert into public.master_items(kind,name,slug,sort_order)
values ('advertisement_type','Sidebar Advertisement','sidebar',40)
on conflict(kind,slug) do update set name=excluded.name,sort_order=excluded.sort_order,deleted_at=null;
