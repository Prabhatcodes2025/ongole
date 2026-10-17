-- Additive launch fixes: required property catalogue, reversible CRM archiving,
-- and query-free analytics landing-page aggregation. No production rows are deleted.
begin;

do $$
declare
  item record;
  existing_category public.property_categories%rowtype;
begin
  for item in select * from (values ('Residential','residential',10),('Commercial','commercial',20),('Agricultural','agricultural',30),('Industrial','industrial',40)) wanted(name,slug,sort_order) loop
    existing_category:=null;
    select * into existing_category
    from public.property_categories
    where slug=item.slug or lower(name)=lower(item.name)
    order by (slug=item.slug) desc
    limit 1;

    if found then
      if existing_category.slug is distinct from item.slug
        or existing_category.name is distinct from item.name
        or existing_category.is_active is distinct from true then
        raise warning 'Canonical property category % (%) conflicts with existing row % (name=%, slug=%, active=%); existing row preserved',
          item.name,item.slug,existing_category.id,existing_category.name,existing_category.slug,existing_category.is_active;
      end if;
    else
      insert into public.property_categories(name,slug,is_active,sort_order)
      values(item.name,item.slug,true,item.sort_order)
      on conflict do nothing;

      if not found then
        raise warning 'Canonical property category % (%) was not inserted because of a concurrent unique conflict; existing rows preserved',item.name,item.slug;
      end if;
    end if;
  end loop;
end $$;

do $$
declare
  item record;
  expected_category_id uuid;
  existing_type public.property_types%rowtype;
begin
  for item in select * from (values
    ('residential','Apartment / Flat','apartment-flat'),('residential','Independent House','independent-house'),
    ('residential','Villa','villa'),('residential','Penthouse','penthouse'),('residential','Residential Plot','open-plot'),
    ('commercial','Shop','shop'),('commercial','Office','office'),('commercial','Shopping Complex','shopping-complex'),
    ('commercial','Commercial Open Plot','commercial-open-plot'),('agricultural','Agricultural Land','agricultural-land'),
    ('agricultural','Farm Land','farm-land'),('industrial','Warehouse','warehouse'),('industrial','Factory','factory'),
    ('industrial','Industrial Land','industrial-land')
  ) wanted(category_slug,name,slug) loop
    select id into expected_category_id from public.property_categories where slug=item.category_slug;
    existing_type:=null;
    select * into existing_type
    from public.property_types
    where slug=item.slug or lower(name)=lower(item.name)
    order by (slug=item.slug) desc
    limit 1;

    if found then
      if existing_type.slug is distinct from item.slug
        or existing_type.name is distinct from item.name
        or existing_type.category_id is distinct from expected_category_id
        or existing_type.is_active is distinct from true then
        raise warning 'Canonical property type % (%) conflicts with existing row % (name=%, slug=%, category_id=%, active=%); existing row preserved',
          item.name,item.slug,existing_type.id,existing_type.name,existing_type.slug,existing_type.category_id,existing_type.is_active;
      end if;
    elsif expected_category_id is null then
      raise warning 'Canonical property type % (%) was not inserted because category % is unavailable; existing rows preserved',item.name,item.slug,item.category_slug;
    else
      insert into public.property_types(category_id,name,slug,is_active)
      values(expected_category_id,item.name,item.slug,true)
      on conflict(slug) do nothing;

      if not found then
        raise warning 'Canonical property type % (%) was not inserted because of a concurrent slug conflict; existing row preserved',item.name,item.slug;
      end if;
    end if;
  end loop;
end $$;

alter table public.enquiries add column if not exists archived_at timestamptz;
alter table public.enquiries add column if not exists archived_by uuid references public.profiles(id);
alter table public.enquiries add column if not exists expires_at timestamptz;
create index if not exists enquiries_crm_lifecycle_idx on public.enquiries(archived_at,expires_at,status,created_at desc);
create index if not exists analytics_events_launch_dimensions_idx on public.analytics_events(created_at,event_type,entity_type,entity_id);

insert into public.website_settings(key,value,is_public)
values('crm.resolved_auto_archive',jsonb_build_object('enabled',false,'age_days',90),false)
on conflict(key) do nothing;

create or replace function public.manage_enquiry_archive(target_ids uuid[],archive_action text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer:=0; enquiry_id uuid;
begin
  if auth.uid() is null or not public.has_permission('enquiries.manage') then raise exception 'permission_denied'; end if;
  if archive_action not in ('archive','restore') or coalesce(array_length(target_ids,1),0)=0 or array_length(target_ids,1)>100 then raise exception 'invalid_request'; end if;
  for enquiry_id in update public.enquiries set archived_at=case when archive_action='archive' then now() else null end,
    archived_by=case when archive_action='archive' then auth.uid() else null end
    where id=any(target_ids) and ((archive_action='archive' and archived_at is null) or (archive_action='restore' and archived_at is not null)) returning id loop
    affected:=affected+1;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
    select auth.uid(),'enquiry.'||archive_action,'enquiry',e.reference_no,jsonb_build_object('archived',archive_action='archive')
    from public.enquiries e where e.id=enquiry_id;
  end loop;
  return affected;
end $$;
revoke all on function public.manage_enquiry_archive(uuid[],text) from public,anon;
grant execute on function public.manage_enquiry_archive(uuid[],text) to authenticated;

create or replace function public.get_launch_analytics(date_from date,date_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.has_permission('analytics.read') then raise exception 'permission_denied'; end if;
  if date_from is null or date_to is null or date_from>date_to or date_to-date_from>366 then raise exception 'invalid_date_range'; end if;
  with events as (
    select event_type,entity_type,entity_id,session_hash,metadata,created_at from public.analytics_events
    where created_at>=date_from::timestamptz and created_at<(date_to+1)::timestamptz
  ), dimensions as (
    select coalesce(nullif(metadata->>'service',''),'Other') name,count(*) count from events group by 1 order by 2 desc
  ), sources as (
    select coalesce(nullif(metadata->>'source',''),'direct') name,count(*) count from events group by 1 order by 2 desc
  ), landing as (
    select split_part(coalesce(nullif(metadata->>'landing_path',''),nullif(metadata->>'path',''),'Unknown'), '?', 1) name,
      count(*) count,count(distinct session_hash) visitors from events where event_type='page_view' group by 1 order by 2 desc limit 100
  ), properties as (
    select coalesce(p.reference_no,e.entity_id::text,'Unknown') reference,count(*) filter(where e.event_type='listing_view') views,
      count(distinct e.session_hash) visitors,count(*) filter(where e.event_type='whatsapp_click') whatsapp,
      count(*) filter(where e.event_type='phone_click') phone,count(*) filter(where e.event_type='map_click') map_clicks,
      count(*) filter(where e.event_type='enquiry_submitted') enquiries
    from events e left join public.properties p on p.id=e.entity_id where e.entity_type in ('property','pg') group by 1 order by 2 desc limit 100
  ) select jsonb_build_object(
    'by_service',coalesce((select jsonb_agg(to_jsonb(dimensions)) from dimensions),'[]'::jsonb),
    'by_source',coalesce((select jsonb_agg(to_jsonb(sources)) from sources),'[]'::jsonb),
    'landing_pages',coalesce((select jsonb_agg(to_jsonb(landing)) from landing),'[]'::jsonb),
    'properties',coalesce((select jsonb_agg(to_jsonb(properties)) from properties),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_launch_analytics(date,date) from public,anon;
grant execute on function public.get_launch_analytics(date,date) to authenticated;

commit;
