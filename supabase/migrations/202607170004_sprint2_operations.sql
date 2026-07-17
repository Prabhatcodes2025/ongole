alter type public.enquiry_status add value if not exists 'assigned';
alter type public.enquiry_status add value if not exists 'follow_up';
alter type public.enquiry_status add value if not exists 'lost';

alter table public.properties add column if not exists is_pinned boolean not null default false;
grant select (is_pinned) on public.properties to anon, authenticated;
alter table public.property_categories add column if not exists deleted_at timestamptz;
alter table public.property_categories add column if not exists usage_count integer not null default 0;
alter table public.property_types add column if not exists deleted_at timestamptz;
alter table public.property_types add column if not exists sort_order integer not null default 0;
alter table public.property_types add column if not exists usage_count integer not null default 0;
alter table public.locations add column if not exists deleted_at timestamptz;
alter table public.locations add column if not exists sort_order integer not null default 0;
alter table public.locations add column if not exists usage_count integer not null default 0;
alter table public.enquiries add column if not exists user_id uuid references public.profiles(id);
alter table public.enquiries add column if not exists visitor_reference text;
alter table public.enquiries add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent'));
alter table public.enquiries add column if not exists follow_up_at timestamptz;
alter table public.enquiries add column if not exists closed_at timestamptz;

create table if not exists public.enquiry_notes (
  id bigint generated always as identity primary key,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  note text not null check (char_length(note) between 1 and 4000),
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.master_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('amenity','highlight','tag','facing','ownership','district','city','locality','advertisement_type')),
  name text not null,
  slug text not null,
  parent_id uuid references public.master_items(id),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind,slug)
);
create index if not exists master_items_lookup_idx on public.master_items(kind,is_active,sort_order,name) where deleted_at is null;
create index if not exists enquiries_operations_idx on public.enquiries(status,priority,follow_up_at,created_at desc);

alter table public.enquiry_notes enable row level security;
alter table public.master_items enable row level security;
create policy enquiry_notes_admin_read on public.enquiry_notes for select using (public.has_permission('enquiries.read'));
create policy enquiry_notes_admin_manage on public.enquiry_notes for all using (public.has_permission('enquiries.manage')) with check (public.has_permission('enquiries.manage'));
create policy master_items_public_read on public.master_items for select using ((is_active and deleted_at is null) or public.has_permission('settings.manage'));
create policy master_items_admin_manage on public.master_items for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy property_history_owner_read on public.property_status_history for select using (exists(select 1 from public.properties p where p.id=property_id and (p.owner_id=auth.uid() or public.has_permission('properties.read'))));

drop policy if exists property_media_admin_manage on storage.objects;
create policy property_media_admin_manage on storage.objects for all to authenticated
using (bucket_id='property-media' and public.has_permission('properties.manage'))
with check (bucket_id='property-media' and public.has_permission('properties.manage'));

create or replace function public.owner_soft_delete_property(target_property uuid)
returns void language plpgsql security definer set search_path=public as $$
declare p public.properties;
begin
  select * into p from public.properties where id=target_property and owner_id=auth.uid() for update;
  if not found then raise exception 'not_authorized'; end if;
  if p.status in ('pending_review','approved','published') then raise exception 'property_locked'; end if;
  update public.properties set deleted_at=now(),status='archived' where id=target_property;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,p.status,'archived',auth.uid(),'Owner deleted property');
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.delete','property',p.reference_no,jsonb_build_object('status',p.status),jsonb_build_object('status','archived','deleted_at',now()));
end $$;

create or replace function public.record_audit_event(event_action text,event_type text,event_reference text,event_old jsonb default null,event_new jsonb default null,event_outcome text default 'success')
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values,outcome)
  values(auth.uid(),left(event_action,120),left(event_type,80),left(event_reference,160),event_old,event_new,left(event_outcome,40));
end $$;

create or replace function public.duplicate_owner_property(target_property uuid)
returns public.properties language plpgsql security definer set search_path=public as $$
declare source public.properties; duplicate public.properties;
begin
  select * into source from public.properties where id=target_property and owner_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'not_authorized'; end if;
  insert into public.properties(owner_id,category_id,property_type_id,transaction_type,title,description,slug,status,location_id,locality_text,city_text,district_text,state_text,latitude,longitude,price_inr,area_value,area_unit,details,contact_visibility)
  values(source.owner_id,source.category_id,source.property_type_id,source.transaction_type,left('Copy of '||source.title,120),source.description,null,'draft',source.location_id,source.locality_text,source.city_text,source.district_text,source.state_text,source.latitude,source.longitude,source.price_inr,source.area_value,source.area_unit,source.details,source.contact_visibility)
  returning * into duplicate;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'property.duplicate','property',duplicate.reference_no,jsonb_build_object('source',source.reference_no));
  return duplicate;
end $$;

insert into public.master_items(kind,name,slug,sort_order) values
('amenity','Parking','parking',10),('amenity','Power Backup','power-backup',20),('amenity','Lift','lift',30),('amenity','Security','security',40),('amenity','Water Supply','water-supply',50),('amenity','Road Access','road-access',60),
('facing','East','east',10),('facing','West','west',20),('facing','North','north',30),('facing','South','south',40),('facing','North East','north-east',50),
('ownership','Freehold','freehold',10),('ownership','Leasehold','leasehold',20),
('advertisement_type','Hero Banner','hero-banner',10),('advertisement_type','Flash Advertisement','flash',20),('advertisement_type','Scrolling Advertisement','scrolling',30),('advertisement_type','Footer Banner','footer-banner',40)
on conflict(kind,slug) do nothing;

create or replace function public.audit_user_role_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values)
  values(auth.uid(),case when tg_op='DELETE' then 'role.remove' else 'role.assign' end,'user_role',coalesce(new.user_id,old.user_id)::text,to_jsonb(old),to_jsonb(new));
  return coalesce(new,old);
end $$;
drop trigger if exists audit_user_role_changes on public.user_roles;
create trigger audit_user_role_changes after insert or delete on public.user_roles for each row execute function public.audit_user_role_change();

create or replace function public.refresh_master_usage_counts()
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.property_categories c set usage_count=(select count(*) from public.properties p where p.category_id=c.id and p.deleted_at is null);
  update public.property_types t set usage_count=(select count(*) from public.properties p where p.property_type_id=t.id and p.deleted_at is null);
  update public.locations l set usage_count=(select count(*) from public.properties p where p.location_id=l.id and p.deleted_at is null);
  update public.master_items m set usage_count=case
    when m.kind='amenity' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'amenities','[]'::jsonb) ? m.name)
    when m.kind='highlight' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'highlights','[]'::jsonb) ? m.name)
    when m.kind='tag' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'tags','[]'::jsonb) ? m.name)
    when m.kind='facing' then (select count(*) from public.properties p where p.deleted_at is null and p.details->>'facing'=m.name)
    when m.kind='ownership' then (select count(*) from public.properties p where p.deleted_at is null and p.details->>'ownership'=m.name)
    when m.kind='district' then (select count(*) from public.properties p where p.deleted_at is null and p.district_text=m.name)
    when m.kind='city' then (select count(*) from public.properties p where p.deleted_at is null and p.city_text=m.name)
    when m.kind='locality' then (select count(*) from public.properties p where p.deleted_at is null and p.locality_text=m.name)
    else m.usage_count end;
end $$;
select public.refresh_master_usage_counts();

create or replace function public.refresh_master_usage_trigger()
returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.refresh_master_usage_counts(); return null; end $$;
drop trigger if exists refresh_master_usage_after_property on public.properties;
create trigger refresh_master_usage_after_property after insert or update or delete on public.properties for each statement execute function public.refresh_master_usage_trigger();

create or replace function public.admin_bulk_property_action(target_properties uuid[],bulk_action text)
returns integer language plpgsql security definer set search_path=public as $$
declare target uuid; p public.properties; next_status public.property_status; affected integer:=0;
begin
  if not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  if bulk_action not in ('publish','archive','delete','activate','deactivate','feature','unfeature','verify','unverify','pin','unpin') then raise exception 'invalid_action'; end if;
  if coalesce(cardinality(target_properties),0)>100 then raise exception 'too_many_records'; end if;
  foreach target in array target_properties loop
    select * into p from public.properties where id=target for update;
    if not found then continue; end if;
    next_status:=p.status;
    if bulk_action='publish' and p.status='approved' then next_status:='published';
    elsif bulk_action in ('archive','deactivate') and p.status not in ('archived','sold','rented','leased') then next_status:='archived';
    elsif bulk_action='activate' and p.status='archived' then next_status:='draft';
    elsif bulk_action='delete' then next_status:='archived'; end if;
    update public.properties set status=next_status,
      published_at=case when bulk_action='publish' and p.status='approved' then now() else published_at end,
      deleted_at=case when bulk_action='delete' then now() when bulk_action='activate' then null else deleted_at end,
      is_featured=case when bulk_action='feature' then true when bulk_action='unfeature' then false else is_featured end,
      is_verified=case when bulk_action='verify' then true when bulk_action='unverify' then false else is_verified end,
      is_pinned=case when bulk_action='pin' then true when bulk_action='unpin' then false else is_pinned end
    where id=target;
    if next_status<>p.status then insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target,p.status,next_status,auth.uid(),'Bulk action: '||bulk_action); end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.bulk_'||bulk_action,'property',p.reference_no,jsonb_build_object('status',p.status),jsonb_build_object('status',next_status));
    affected:=affected+1;
  end loop;
  return affected;
end $$;
