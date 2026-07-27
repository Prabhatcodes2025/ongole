-- Replace the statement-level property usage refresh that issued unbounded UPDATEs.
-- Forward-only; safe after 202607180004_property_draft_creation_hotfix.sql.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.record_initial_property_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'draft' then
    raise exception 'initial_property_status_must_be_draft';
  end if;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason)
  values(new.id,null,'draft',new.owner_id,'Property draft created');
  return new;
end $$;

-- Preserve the administrative full-refresh helper without any unbounded UPDATE.
-- Each statement is constrained to the single row selected by the loop.
create or replace function public.refresh_master_usage_counts()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
begin
  for target_id in select id from public.property_categories loop
    update public.property_categories c
    set usage_count=(select count(*) from public.properties p where p.category_id=c.id and p.deleted_at is null)
    where c.id=target_id;
  end loop;

  for target_id in select id from public.property_types loop
    update public.property_types t
    set usage_count=(select count(*) from public.properties p where p.property_type_id=t.id and p.deleted_at is null)
    where t.id=target_id;
  end loop;

  for target_id in select id from public.locations loop
    update public.locations l
    set usage_count=(select count(*) from public.properties p where p.location_id=l.id and p.deleted_at is null)
    where l.id=target_id;
  end loop;

  for target_id in select id from public.master_items loop
    update public.master_items m set usage_count=case
      when m.kind='amenity' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'amenities','[]'::jsonb) ? m.name)
      when m.kind='highlight' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'highlights','[]'::jsonb) ? m.name)
      when m.kind='tag' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'tags','[]'::jsonb) ? m.name)
      when m.kind='facing' then (select count(*) from public.properties p where p.deleted_at is null and p.details->>'facing'=m.name)
      when m.kind='ownership' then (select count(*) from public.properties p where p.deleted_at is null and p.details->>'ownership'=m.name)
      when m.kind='district' then (select count(*) from public.properties p where p.deleted_at is null and p.district_text=m.name)
      when m.kind='city' then (select count(*) from public.properties p where p.deleted_at is null and p.city_text=m.name)
      when m.kind='locality' then (select count(*) from public.properties p where p.deleted_at is null and p.locality_text=m.name)
      else m.usage_count end
    where m.id=target_id;
  end loop;
end $$;

create or replace function public.refresh_master_usage_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_category uuid;
  new_category uuid;
  old_type uuid;
  new_type uuid;
  old_location uuid;
  new_location uuid;
  old_details jsonb := '{}'::jsonb;
  new_details jsonb := '{}'::jsonb;
  old_district text;
  new_district text;
  old_city text;
  new_city text;
  old_locality text;
  new_locality text;
begin
  if tg_op <> 'INSERT' then
    old_category:=old.category_id;
    old_type:=old.property_type_id;
    old_location:=old.location_id;
    old_details:=coalesce(old.details,'{}'::jsonb);
    old_district:=old.district_text;
    old_city:=old.city_text;
    old_locality:=old.locality_text;
  end if;
  if tg_op <> 'DELETE' then
    new_category:=new.category_id;
    new_type:=new.property_type_id;
    new_location:=new.location_id;
    new_details:=coalesce(new.details,'{}'::jsonb);
    new_district:=new.district_text;
    new_city:=new.city_text;
    new_locality:=new.locality_text;
  end if;

  update public.property_categories c
  set usage_count=(select count(*) from public.properties p where p.category_id=c.id and p.deleted_at is null)
  where c.id=any(array_remove(array[old_category,new_category],null));

  update public.property_types t
  set usage_count=(select count(*) from public.properties p where p.property_type_id=t.id and p.deleted_at is null)
  where t.id=any(array_remove(array[old_type,new_type],null));

  update public.locations l
  set usage_count=(select count(*) from public.properties p where p.location_id=l.id and p.deleted_at is null)
  where l.id=any(array_remove(array[old_location,new_location],null));

  update public.master_items m set usage_count=case
    when m.kind='amenity' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'amenities','[]'::jsonb) ? m.name)
    when m.kind='highlight' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'highlights','[]'::jsonb) ? m.name)
    when m.kind='tag' then (select count(*) from public.properties p where p.deleted_at is null and coalesce(p.details->'tags','[]'::jsonb) ? m.name)
    when m.kind='facing' then (select count(*) from public.properties p where p.deleted_at is null and p.details->>'facing'=m.name)
    when m.kind='ownership' then (select count(*) from public.properties p where p.deleted_at is null and p.details->>'ownership'=m.name)
    when m.kind='district' then (select count(*) from public.properties p where p.deleted_at is null and p.district_text=m.name)
    when m.kind='city' then (select count(*) from public.properties p where p.deleted_at is null and p.city_text=m.name)
    when m.kind='locality' then (select count(*) from public.properties p where p.deleted_at is null and p.locality_text=m.name)
    else m.usage_count end
  where
    (m.kind='amenity' and ((old_details->'amenities') ? m.name or (new_details->'amenities') ? m.name))
    or (m.kind='highlight' and ((old_details->'highlights') ? m.name or (new_details->'highlights') ? m.name))
    or (m.kind='tag' and ((old_details->'tags') ? m.name or (new_details->'tags') ? m.name))
    or (m.kind='facing' and m.name in (old_details->>'facing',new_details->>'facing'))
    or (m.kind='ownership' and m.name in (old_details->>'ownership',new_details->>'ownership'))
    or (m.kind='district' and m.name in (old_district,new_district))
    or (m.kind='city' and m.name in (old_city,new_city))
    or (m.kind='locality' and m.name in (old_locality,new_locality));

  return case when tg_op='DELETE' then old else new end;
end $$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.record_initial_property_history() from public;
revoke all on function public.refresh_master_usage_counts() from public;
revoke all on function public.refresh_master_usage_trigger() from public;

drop trigger if exists refresh_master_usage_after_property on public.properties;
create trigger refresh_master_usage_after_property
after insert or update or delete on public.properties
for each row execute function public.refresh_master_usage_trigger();
