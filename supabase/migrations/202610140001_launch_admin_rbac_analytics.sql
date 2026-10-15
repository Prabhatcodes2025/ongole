-- Launch hardening: privileged posting, audited PG editing, and richer privacy-safe analytics.
-- Forward-only; normal user posting limits and public listing policies remain unchanged.

begin;

drop policy if exists media_admin_manage on public.property_media;
create policy media_admin_manage on public.property_media for all
using (
  public.has_permission('properties.manage')
  or (
    public.has_permission('pg.manage')
    and exists(select 1 from public.pg_listings pg where pg.property_id=property_media.property_id)
  )
)
with check (
  public.has_permission('properties.manage')
  or (
    public.has_permission('pg.manage')
    and exists(select 1 from public.pg_listings pg where pg.property_id=property_media.property_id)
  )
);

drop policy if exists property_media_pg_admin_manage on storage.objects;
create policy property_media_pg_admin_manage on storage.objects for all to authenticated
using (
  bucket_id='property-media'
  and public.has_permission('pg.manage')
  and exists(
    select 1 from public.pg_listings pg
    where pg.property_id::text=(storage.foldername(name))[2]
  )
)
with check (
  bucket_id='property-media'
  and public.has_permission('pg.manage')
  and exists(
    select 1 from public.pg_listings pg
    where pg.property_id::text=(storage.foldername(name))[2]
  )
);

create or replace function public.check_property_posting_permission()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare used_count integer; grant_count integer; privileged boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  privileged:=public.has_permission('properties.manage');
  select count(*) into used_count from public.property_posting_uses where user_id=auth.uid();
  select count(*) into grant_count from public.property_posting_grants where user_id=auth.uid();
  return jsonb_build_object(
    'allowed',privileged or used_count < 1+grant_count,
    'privileged',privileged,
    'consumed',used_count,
    'limit',case when privileged then null else 1+grant_count end,
    'additional_permissions',grant_count
  );
end $$;

create or replace function public.check_pg_posting_permission()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare used_count integer; grant_count integer; privileged boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  privileged:=public.has_permission('properties.manage') or public.has_permission('pg.manage');
  select count(*) into used_count from public.property_posting_uses where user_id=auth.uid();
  select count(*) into grant_count from public.property_posting_grants where user_id=auth.uid();
  return jsonb_build_object(
    'allowed',privileged or used_count < 1+grant_count,
    'privileged',privileged,
    'consumed',used_count,
    'limit',case when privileged then null else 1+grant_count end,
    'additional_permissions',grant_count
  );
end $$;

revoke all on function public.check_pg_posting_permission() from public,anon;
grant execute on function public.check_pg_posting_permission() to authenticated;

create or replace function public.consume_property_posting_permission(target_property uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare property_owner uuid; used_count integer; grant_count integer; privileged boolean; pg_workflow boolean;
begin
  select owner_id into property_owner from public.properties where id=target_property for update;
  if property_owner is null or property_owner<>auth.uid() then raise exception 'not_authorized'; end if;
  if exists(select 1 from public.property_posting_uses where property_id=target_property) then return; end if;
  select exists(select 1 from public.pg_listings pg where pg.property_id=target_property) into pg_workflow;
  privileged:=public.has_permission('properties.manage') or (pg_workflow and public.has_permission('pg.manage'));
  if not privileged then
    perform 1 from public.profiles where id=auth.uid() for update;
    select count(*) into used_count from public.property_posting_uses where user_id=auth.uid();
    select count(*) into grant_count from public.property_posting_grants where user_id=auth.uid();
    if used_count>=1+grant_count then raise exception 'PROPERTY_POSTING_LIMIT_REACHED'; end if;
  end if;
  insert into public.property_posting_uses(property_id,user_id) values(target_property,auth.uid());
  if privileged then
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
    values(auth.uid(),'property.privileged_posting_bypass','property',target_property::text,jsonb_build_object('reason','administrator'));
  end if;
end $$;

create or replace function public.update_pg_draft(target_pg uuid,pg_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare pg_record public.pg_listings; property_record public.properties; category_value text; privileged boolean;
begin
  privileged:=public.has_permission('pg.manage');
  select pg.* into pg_record from public.pg_listings pg join public.properties p on p.id=pg.property_id
  where pg.id=target_pg and p.deleted_at is null
    and ((p.owner_id=auth.uid() and p.status in ('draft','changes_requested')) or privileged)
  for update of pg;
  if not found then raise exception 'not_authorized_or_locked'; end if;
  category_value:=coalesce(nullif(trim(pg_payload->>'category'),''),pg_record.category);
  if category_value not in ('mens','womens','family','co_living') then raise exception 'invalid_pg_category'; end if;
  update public.properties p set
    title=left(case when pg_payload ? 'pg_name' and char_length(trim(pg_payload->>'pg_name'))<10 then trim(pg_payload->>'pg_name')||' Paying Guest' else coalesce(nullif(trim(pg_payload->>'pg_name'),''),p.title) end,120),
    description=coalesce(pg_payload->>'description',p.description),
    locality_text=coalesce(nullif(trim(pg_payload->>'locality'),''),p.locality_text),city_text=coalesce(nullif(trim(pg_payload->>'city'),''),p.city_text),
    district_text=coalesce(nullif(trim(pg_payload->>'district'),''),p.district_text),state_text=coalesce(nullif(trim(pg_payload->>'state'),''),p.state_text),
    latitude=case when pg_payload ? 'latitude' then nullif(pg_payload->>'latitude','')::numeric else p.latitude end,
    longitude=case when pg_payload ? 'longitude' then nullif(pg_payload->>'longitude','')::numeric else p.longitude end,
    price_inr=case when pg_payload ? 'rent_per_bed' then greatest(coalesce(nullif(pg_payload->>'rent_per_bed','')::numeric,0),0) else p.price_inr end
  where p.id=pg_record.property_id returning * into property_record;
  update public.pg_listings pg set
    pg_name=left(coalesce(nullif(trim(pg_payload->>'pg_name'),''),pg.pg_name),120),category=category_value,
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
  values(auth.uid(),case when privileged then 'pg.admin_update' else 'pg.update' end,'paying_guest',property_record.reference_no,jsonb_build_object('pg_id',target_pg));
  return jsonb_build_object('id',pg_record.id,'property_id',property_record.id,'reference_no',property_record.reference_no);
end $$;

create or replace function public.get_launch_analytics(date_from date,date_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.has_permission('analytics.read') then raise exception 'permission_denied'; end if;
  if date_from is null or date_to is null or date_from>date_to or date_to-date_from>366 then raise exception 'invalid_date_range'; end if;
  with events as (
    select event_type,entity_type,entity_id,session_hash,metadata,created_at
    from public.analytics_events where created_at>=date_from::timestamptz and created_at<(date_to+1)::timestamptz
  ), dimensions as (
    select coalesce(nullif(metadata->>'service',''),'Other') name,count(*) count from events group by 1 order by 2 desc
  ), sources as (
    select coalesce(nullif(metadata->>'source',''),'direct') name,count(*) count from events group by 1 order by 2 desc
  ), landing as (
    select coalesce(nullif(metadata->>'landing_path',''),nullif(metadata->>'path',''),'Unknown') name,count(*) count,count(distinct session_hash) visitors from events where event_type='page_view' group by 1 order by 2 desc limit 100
  ), properties as (
    select coalesce(p.reference_no,e.entity_id::text,'Unknown') reference,count(*) filter(where e.event_type='listing_view') views,count(distinct e.session_hash) visitors,
      count(*) filter(where e.event_type='whatsapp_click') whatsapp,count(*) filter(where e.event_type='phone_click') phone,
      count(*) filter(where e.event_type='map_click') map_clicks,count(*) filter(where e.event_type='enquiry_submitted') enquiries
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

create or replace function public.deactivate_current_account(confirmed_email text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare account_email citext; account_confirmed timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select email,email_confirmed_at into account_email,account_confirmed from auth.users where id=auth.uid();
  perform 1 from public.profiles where id=auth.uid() for update;
  if account_confirmed is null or account_email is null or lower(trim(confirmed_email))<>lower(account_email::text) then raise exception 'confirmation_failed'; end if;
  if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.code in ('super_admin','admin')) then raise exception 'administrator_support_required'; end if;
  update public.profiles set status='blocked',deactivated_at=now(),deactivation_reason='self_deactivated',updated_at=now() where id=auth.uid();
  perform public.record_audit_event('account.self_deactivate','profile',auth.uid()::text,null,jsonb_build_object('recoverable',true));
end $$;

commit;
