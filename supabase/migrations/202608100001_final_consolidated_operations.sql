-- Final consolidated operational controls. Additive and safe for the existing schema.

grant select, insert, update, delete on public.seo_overrides, public.url_history to authenticated;

create or replace function public.admin_set_user_status(target_user uuid, next_status public.user_status, change_reason text)
returns public.profiles
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare current_profile public.profiles; old_status public.user_status;
begin
  if not public.has_permission('users.manage') then raise exception 'not_authorized'; end if;
  if target_user = auth.uid() and next_status <> 'active' then raise exception 'cannot_suspend_self'; end if;
  if nullif(trim(change_reason),'') is null then raise exception 'reason_required'; end if;
  select * into current_profile from public.profiles where id=target_user for update;
  if not found then raise exception 'user_not_found'; end if;
  old_status := current_profile.status;
  update public.profiles set status=next_status where id=target_user returning * into current_profile;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values,outcome)
  values(auth.uid(),'user.status_changed','user',current_profile.reference_no,jsonb_build_object('status',old_status),jsonb_build_object('status',next_status,'reason',trim(change_reason)),'success');
  return current_profile;
end $$;

create or replace function public.admin_set_property_visibility(target_property uuid, next_contact_visibility text default null, next_map_visible boolean default null)
returns public.properties
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare current_property public.properties; allowed boolean;
begin
  allowed := public.has_permission('properties.manage') or
    (public.has_permission('pg.manage') and exists(select 1 from public.pg_listings where property_id=target_property));
  if not allowed then raise exception 'not_authorized'; end if;
  if next_contact_visibility is not null and next_contact_visibility not in ('company','eligible_members','public') then raise exception 'invalid_contact_visibility'; end if;
  select * into current_property from public.properties where id=target_property for update;
  if not found then raise exception 'property_not_found'; end if;
  update public.properties
  set contact_visibility=coalesce(next_contact_visibility,contact_visibility),
      is_premium=coalesce(next_map_visible,is_premium)
  where id=target_property
  returning * into current_property;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values,outcome)
  values(auth.uid(),'property.visibility_changed','property',current_property.reference_no,jsonb_build_object('contact_visibility',current_property.contact_visibility,'map_visible',current_property.is_premium),'success');
  return current_property;
end $$;

revoke all on function public.admin_set_user_status(uuid,public.user_status,text) from public;
revoke all on function public.admin_set_property_visibility(uuid,text,boolean) from public;
grant execute on function public.admin_set_user_status(uuid,public.user_status,text) to authenticated;
grant execute on function public.admin_set_property_visibility(uuid,text,boolean) to authenticated;

create index if not exists properties_admin_filter_idx on public.properties(transaction_type,status,city_text,locality_text,updated_at desc) where deleted_at is null;
create index if not exists profiles_admin_filter_idx on public.profiles(account_type,status,created_at desc);
create index if not exists url_history_entity_idx on public.url_history(entity_type,entity_id,created_at desc);
