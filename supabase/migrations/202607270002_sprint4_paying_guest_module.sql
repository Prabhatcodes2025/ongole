-- Sprint 4: Paying Guest management built on the existing property lifecycle.
-- Forward-only and safe after 202607270001_property_trigger_update_hotfix.sql.

insert into public.permissions(code,module,description) values
  ('pg.read','paying_guest','View private and review-stage PG listings'),
  ('pg.manage','paying_guest','Review, approve, publish and administer PG listings')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='super_admin' and p.code in ('pg.read','pg.manage')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='property_manager' and p.code in ('pg.read','pg.manage')
on conflict do nothing;

alter table public.pg_listings
  add column if not exists address_line text not null default '',
  add column if not exists amenities text[] not null default '{}',
  add column if not exists house_rules text[] not null default '{}',
  add column if not exists video_urls text[] not null default '{}',
  add column if not exists contact_name text,
  add column if not exists contact_mobile text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_email citext,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.pg_listings drop constraint if exists pg_listings_contact_mobile_check;
alter table public.pg_listings add constraint pg_listings_contact_mobile_check
  check (contact_mobile is null or contact_mobile ~ '^[6-9][0-9]{9}$');
alter table public.pg_listings drop constraint if exists pg_listings_contact_whatsapp_check;
alter table public.pg_listings add constraint pg_listings_contact_whatsapp_check
  check (contact_whatsapp is null or contact_whatsapp ~ '^[6-9][0-9]{9}$');
alter table public.pg_listings drop constraint if exists pg_listings_rent_check;
alter table public.pg_listings add constraint pg_listings_rent_check
  check (rent_per_bed >= 0 and (security_deposit is null or security_deposit >= 0) and (capacity is null or capacity >= 0));

create table if not exists public.pg_room_types (
  id uuid primary key default gen_random_uuid(),
  pg_listing_id uuid not null references public.pg_listings(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  sharing_type text not null check (sharing_type in ('single','double','triple','four_sharing')),
  capacity integer not null check (capacity > 0),
  available_beds integer not null default 0 check (available_beds >= 0 and available_beds <= capacity),
  monthly_rent numeric(12,2) not null check (monthly_rent >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  details jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pg_listings_category_idx on public.pg_listings(category,rent_per_bed);
create index if not exists pg_listings_property_idx on public.pg_listings(property_id);
create index if not exists pg_room_types_listing_idx on public.pg_room_types(pg_listing_id,sort_order);
create index if not exists pg_room_types_search_idx on public.pg_room_types(sharing_type,monthly_rent,available_beds);
create index if not exists pg_listings_name_trgm_idx on public.pg_listings using gin(pg_name extensions.gin_trgm_ops);

drop trigger if exists pg_listings_updated on public.pg_listings;
create trigger pg_listings_updated before update on public.pg_listings
for each row execute function public.set_updated_at();
drop trigger if exists pg_room_types_updated on public.pg_room_types;
create trigger pg_room_types_updated before update on public.pg_room_types
for each row execute function public.set_updated_at();

alter table public.pg_room_types enable row level security;

drop policy if exists pg_public_read on public.pg_listings;
create policy pg_public_read on public.pg_listings for select using (
  exists (
    select 1 from public.properties p
    where p.id=property_id and (
      (p.status='published' and p.deleted_at is null)
      or p.owner_id=auth.uid()
      or public.has_permission('pg.read')
    )
  )
);
drop policy if exists pg_owner_insert on public.pg_listings;
create policy pg_owner_insert on public.pg_listings for insert with check (
  exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid() and p.status='draft')
);
drop policy if exists pg_owner_update on public.pg_listings;
create policy pg_owner_update on public.pg_listings for update using (
  exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid() and p.status in ('draft','changes_requested'))
) with check (
  exists(select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid() and p.status in ('draft','changes_requested'))
);
drop policy if exists pg_admin_manage on public.pg_listings;
create policy pg_admin_manage on public.pg_listings for all
using (public.has_permission('pg.manage')) with check (public.has_permission('pg.manage'));

drop policy if exists pg_rooms_public_read on public.pg_room_types;
create policy pg_rooms_public_read on public.pg_room_types for select using (
  exists (
    select 1 from public.pg_listings pg join public.properties p on p.id=pg.property_id
    where pg.id=pg_listing_id and (
      (p.status='published' and p.deleted_at is null)
      or p.owner_id=auth.uid()
      or public.has_permission('pg.read')
    )
  )
);
drop policy if exists pg_rooms_owner_manage on public.pg_room_types;
create policy pg_rooms_owner_manage on public.pg_room_types for all using (
  exists (
    select 1 from public.pg_listings pg join public.properties p on p.id=pg.property_id
    where pg.id=pg_listing_id and p.owner_id=auth.uid() and p.status in ('draft','changes_requested')
  )
) with check (
  exists (
    select 1 from public.pg_listings pg join public.properties p on p.id=pg.property_id
    where pg.id=pg_listing_id and p.owner_id=auth.uid() and p.status in ('draft','changes_requested')
  )
);
drop policy if exists pg_rooms_admin_manage on public.pg_room_types;
create policy pg_rooms_admin_manage on public.pg_room_types for all
using (public.has_permission('pg.manage')) with check (public.has_permission('pg.manage'));

grant select,insert,update,delete on public.pg_listings,public.pg_room_types to authenticated;
revoke select on public.pg_listings,public.pg_room_types from anon;
grant select(id,property_id,pg_name,category,rent_per_bed,room_type,security_deposit,capacity,food_type,details,address_line,amenities,house_rules,video_urls,created_at,updated_at) on public.pg_listings to anon;
grant select(id,pg_listing_id,name,sharing_type,capacity,available_beds,monthly_rent,security_deposit,details,sort_order) on public.pg_room_types to anon;

create or replace function public.create_pg_draft(pg_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  property_record public.properties;
  pg_record public.pg_listings;
  category_value text:=coalesce(nullif(trim(pg_payload->>'category'),''),'co_living');
  name_value text:=left(coalesce(nullif(trim(pg_payload->>'pg_name'),''),'Untitled PG'),120);
  slug_value text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if char_length(name_value)<3 then raise exception 'invalid_pg_name'; end if;
  if category_value not in ('mens','womens','family','co_living') then raise exception 'invalid_pg_category'; end if;
  slug_value:=trim(both '-' from regexp_replace(lower(name_value),'[^a-z0-9]+','-','g'))||'-'||gen_random_uuid()::text;
  insert into public.properties(
    owner_id,transaction_type,title,description,slug,status,locality_text,city_text,district_text,state_text,
    latitude,longitude,price_inr,details
  ) values (
    auth.uid(),'rent',left(case when char_length(name_value)<10 then name_value||' Paying Guest' else name_value end,120),
    coalesce(pg_payload->>'description',''),slug_value,'draft',
    coalesce(nullif(trim(pg_payload->>'locality'),''),'Ongole'),
    coalesce(nullif(trim(pg_payload->>'city'),''),'Ongole'),
    coalesce(nullif(trim(pg_payload->>'district'),''),'Prakasam'),
    coalesce(nullif(trim(pg_payload->>'state'),''),'Andhra Pradesh'),
    nullif(pg_payload->>'latitude','')::numeric,nullif(pg_payload->>'longitude','')::numeric,
    greatest(coalesce(nullif(pg_payload->>'rent_per_bed','')::numeric,0),0),
    jsonb_build_object('listing_kind','paying_guest')
  ) returning * into property_record;
  insert into public.pg_listings(
    property_id,pg_name,category,rent_per_bed,security_deposit,capacity,food_type,address_line,
    amenities,house_rules,video_urls,contact_name,contact_mobile,contact_whatsapp,contact_email,details
  ) values (
    property_record.id,name_value,category_value,greatest(coalesce(nullif(pg_payload->>'rent_per_bed','')::numeric,0),0),
    nullif(pg_payload->>'security_deposit','')::numeric,nullif(pg_payload->>'capacity','')::integer,
    nullif(trim(pg_payload->>'food_type'),''),coalesce(pg_payload->>'address_line',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(pg_payload->'amenities','[]'::jsonb))),'{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(pg_payload->'house_rules','[]'::jsonb))),'{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(pg_payload->'video_urls','[]'::jsonb))),'{}'),
    nullif(trim(pg_payload->>'contact_name'),''),nullif(pg_payload->>'contact_mobile',''),
    nullif(pg_payload->>'contact_whatsapp',''),nullif(pg_payload->>'contact_email','')::citext,'{}'
  ) returning * into pg_record;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'pg.create','paying_guest',property_record.reference_no,jsonb_build_object('pg_id',pg_record.id,'status','draft'));
  return jsonb_build_object('id',pg_record.id,'property_id',property_record.id,'reference_no',property_record.reference_no);
end $$;

create or replace function public.update_pg_draft(target_pg uuid,pg_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pg_record public.pg_listings;
  property_record public.properties;
  category_value text;
begin
  select pg.* into pg_record from public.pg_listings pg join public.properties p on p.id=pg.property_id
  where pg.id=target_pg and p.owner_id=auth.uid() and p.status in ('draft','changes_requested') for update of pg;
  if not found then raise exception 'not_authorized_or_locked'; end if;
  category_value:=coalesce(nullif(trim(pg_payload->>'category'),''),pg_record.category);
  if category_value not in ('mens','womens','family','co_living') then raise exception 'invalid_pg_category'; end if;
  update public.properties p set
    title=left(case
      when pg_payload ? 'pg_name' and char_length(trim(pg_payload->>'pg_name'))<10 then trim(pg_payload->>'pg_name')||' Paying Guest'
      else coalesce(nullif(trim(pg_payload->>'pg_name'),''),p.title)
    end,120),
    description=coalesce(pg_payload->>'description',p.description),
    locality_text=coalesce(nullif(trim(pg_payload->>'locality'),''),p.locality_text),
    city_text=coalesce(nullif(trim(pg_payload->>'city'),''),p.city_text),
    district_text=coalesce(nullif(trim(pg_payload->>'district'),''),p.district_text),
    state_text=coalesce(nullif(trim(pg_payload->>'state'),''),p.state_text),
    latitude=case when pg_payload ? 'latitude' then nullif(pg_payload->>'latitude','')::numeric else p.latitude end,
    longitude=case when pg_payload ? 'longitude' then nullif(pg_payload->>'longitude','')::numeric else p.longitude end,
    price_inr=case when pg_payload ? 'rent_per_bed' then greatest(coalesce(nullif(pg_payload->>'rent_per_bed','')::numeric,0),0) else p.price_inr end
  where p.id=pg_record.property_id returning * into property_record;
  update public.pg_listings pg set
    pg_name=left(coalesce(nullif(trim(pg_payload->>'pg_name'),''),pg.pg_name),120),
    category=category_value,
    rent_per_bed=case when pg_payload ? 'rent_per_bed' then greatest(coalesce(nullif(pg_payload->>'rent_per_bed','')::numeric,0),0) else pg.rent_per_bed end,
    security_deposit=case when pg_payload ? 'security_deposit' then nullif(pg_payload->>'security_deposit','')::numeric else pg.security_deposit end,
    capacity=case when pg_payload ? 'capacity' then nullif(pg_payload->>'capacity','')::integer else pg.capacity end,
    food_type=case when pg_payload ? 'food_type' then nullif(trim(pg_payload->>'food_type'),'') else pg.food_type end,
    address_line=coalesce(pg_payload->>'address_line',pg.address_line),
    amenities=case when pg_payload ? 'amenities' then coalesce(array(select jsonb_array_elements_text(pg_payload->'amenities')),'{}') else pg.amenities end,
    house_rules=case when pg_payload ? 'house_rules' then coalesce(array(select jsonb_array_elements_text(pg_payload->'house_rules')),'{}') else pg.house_rules end,
    video_urls=case when pg_payload ? 'video_urls' then coalesce(array(select jsonb_array_elements_text(pg_payload->'video_urls')),'{}') else pg.video_urls end,
    contact_name=case when pg_payload ? 'contact_name' then nullif(trim(pg_payload->>'contact_name'),'') else pg.contact_name end,
    contact_mobile=case when pg_payload ? 'contact_mobile' then nullif(pg_payload->>'contact_mobile','') else pg.contact_mobile end,
    contact_whatsapp=case when pg_payload ? 'contact_whatsapp' then nullif(pg_payload->>'contact_whatsapp','') else pg.contact_whatsapp end,
    contact_email=case when pg_payload ? 'contact_email' then nullif(pg_payload->>'contact_email','')::citext else pg.contact_email end
  where pg.id=target_pg returning * into pg_record;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'pg.update','paying_guest',property_record.reference_no,jsonb_build_object('pg_id',target_pg));
  return jsonb_build_object('id',pg_record.id,'property_id',property_record.id,'reference_no',property_record.reference_no);
end $$;

create or replace function public.duplicate_pg_listing(target_pg uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_pg public.pg_listings;
  source_property public.properties;
  property_record public.properties;
  pg_record public.pg_listings;
begin
  select pg.* into source_pg from public.pg_listings pg join public.properties p on p.id=pg.property_id
  where pg.id=target_pg and p.owner_id=auth.uid() and p.deleted_at is null;
  if not found then raise exception 'not_authorized'; end if;
  select p.* into strict source_property from public.properties p where p.id=source_pg.property_id;
  insert into public.properties(owner_id,transaction_type,title,description,slug,status,locality_text,city_text,district_text,state_text,latitude,longitude,price_inr,details)
  values(
    auth.uid(),'rent',left('Copy of '||source_property.title,120),source_property.description,
    trim(both '-' from regexp_replace(lower('copy-of-'||source_pg.pg_name),'[^a-z0-9]+','-','g'))||'-'||gen_random_uuid()::text,
    'draft',source_property.locality_text,source_property.city_text,source_property.district_text,
    source_property.state_text,source_property.latitude,source_property.longitude,
    source_property.price_inr,source_property.details
  )
  returning * into property_record;
  insert into public.pg_listings(property_id,pg_name,category,rent_per_bed,room_type,security_deposit,capacity,food_type,details,address_line,amenities,house_rules,video_urls,contact_name,contact_mobile,contact_whatsapp,contact_email)
  values(property_record.id,left('Copy of '||source_pg.pg_name,120),source_pg.category,source_pg.rent_per_bed,source_pg.room_type,source_pg.security_deposit,source_pg.capacity,source_pg.food_type,source_pg.details,source_pg.address_line,source_pg.amenities,source_pg.house_rules,source_pg.video_urls,source_pg.contact_name,source_pg.contact_mobile,source_pg.contact_whatsapp,source_pg.contact_email)
  returning * into pg_record;
  insert into public.pg_room_types(pg_listing_id,name,sharing_type,capacity,available_beds,monthly_rent,security_deposit,details,sort_order)
  select pg_record.id,name,sharing_type,capacity,available_beds,monthly_rent,security_deposit,details,sort_order
  from public.pg_room_types where pg_listing_id=target_pg;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'pg.duplicate','paying_guest',property_record.reference_no,jsonb_build_object('source_pg_id',target_pg));
  return jsonb_build_object('id',pg_record.id,'property_id',property_record.id,'reference_no',property_record.reference_no);
end $$;

create or replace function public.submit_pg_for_review(target_pg uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pg_record public.pg_listings;
  property_record public.properties;
  room_count integer;
begin
  select pg.* into pg_record from public.pg_listings pg join public.properties p on p.id=pg.property_id
  where pg.id=target_pg and p.owner_id=auth.uid() for update of pg;
  if not found then raise exception 'not_authorized'; end if;
  select p.* into strict property_record from public.properties p
  where p.id=pg_record.property_id and p.owner_id=auth.uid() for update;
  if property_record.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
  select count(*) into room_count from public.pg_room_types where pg_listing_id=target_pg;
  if char_length(property_record.description)<40 or char_length(pg_record.address_line)<5 or room_count=0 then raise exception 'pg_incomplete'; end if;
  update public.properties set status='pending_review',submitted_at=now() where id=property_record.id;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason)
  values(property_record.id,property_record.status,'pending_review',auth.uid(),'PG submitted for review');
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'pg.submit','paying_guest',property_record.reference_no,jsonb_build_object('status','pending_review','pg_id',target_pg));
  return jsonb_build_object('id',target_pg,'property_id',property_record.id,'status','pending_review');
end $$;

revoke all on function public.create_pg_draft(jsonb) from public;
revoke all on function public.update_pg_draft(uuid,jsonb) from public;
revoke all on function public.duplicate_pg_listing(uuid) from public;
revoke all on function public.submit_pg_for_review(uuid) from public;
grant execute on function public.create_pg_draft(jsonb) to authenticated;
grant execute on function public.update_pg_draft(uuid,jsonb) to authenticated;
grant execute on function public.duplicate_pg_listing(uuid) to authenticated;
grant execute on function public.submit_pg_for_review(uuid) to authenticated;
