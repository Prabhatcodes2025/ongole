-- Post-Sprint-3 production acceptance corrections.
-- This migration is intentionally additive/idempotent and is safe after all prior migrations.

-- Ongole's local convention is 1 Gadi = 72 square feet. Replacing the immutable
-- conversion function changes future generated values; the no-op update refreshes
-- already stored generated values for existing Gadi records.
create or replace function public.area_to_sq_ft(area_value numeric, area_unit text)
returns numeric language sql immutable strict set search_path = public as $$
  select area_value * case area_unit
    when 'gadi' then 72
    when 'sq_ft' then 1
    when 'sq_yd' then 9
    when 'sq_m' then 10.763910416709722
    when 'acre' then 43560
    when 'cent' then 435.6
    when 'gunta' then 1089
    when 'hectare' then 107639.10416709722
    else null end
$$;
update public.properties set area_value = area_value where area_unit = 'gadi';

-- Never trust signup metadata for privileged profile attributes. Roles are granted
-- separately through user_roles and cannot be selected by a new registrant.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_account_type text;
begin
  requested_account_type := coalesce(new.raw_user_meta_data->>'account_type','buyer');
  if requested_account_type not in ('buyer','owner','agent','pg_owner') then
    requested_account_type := 'buyer';
  end if;
  insert into public.profiles(id, full_name, email, mobile, account_type, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    new.raw_user_meta_data->>'mobile',
    requested_account_type,
    new.email_confirmed_at is not null
  );
  return new;
end $$;

-- Self-service profile changes are limited to display/contact fields. Status,
-- verification flags and account type remain administrative data.
revoke update on public.profiles from authenticated;
grant update(full_name, mobile) on public.profiles to authenticated;

-- Anonymous clients use the deliberately restricted column grant from
-- 202607170002. Authenticated users may read complete rows only when they own the
-- record or have the relevant permission; public pages use the anonymous client.
drop policy if exists properties_public_read on public.properties;
create policy properties_public_read on public.properties for select using (
  (auth.role() = 'anon' and status = 'published' and deleted_at is null)
  or owner_id = auth.uid()
  or public.has_permission('properties.read')
);

-- Property owners may see enquiries attached to their own listings, but cannot
-- update CRM fields or view enquiries for anybody else's property.
drop policy if exists enquiry_owner_read on public.enquiries;
create policy enquiry_owner_read on public.enquiries for select using (
  exists (
    select 1 from public.properties p
    where p.id = enquiries.property_id and p.owner_id = auth.uid()
  )
);

-- Role assignment is only exposed through permission-checked RPCs. Direct table
-- writes from authenticated clients are removed even for administrators.
revoke insert, update, delete on public.user_roles from authenticated;

create or replace function public.assign_user_role(target_user uuid, target_role text)
returns void language plpgsql security definer set search_path = public as $$
declare role_identifier uuid;
begin
  if not public.has_permission('roles.manage') then raise exception 'not_authorized'; end if;
  select id into role_identifier from public.roles where code = target_role;
  if role_identifier is null then raise exception 'role_not_found'; end if;
  insert into public.user_roles(user_id, role_id, assigned_by)
  values(target_user, role_identifier, auth.uid())
  on conflict(user_id, role_id) do nothing;
end $$;

create or replace function public.remove_user_role(target_user uuid, target_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('roles.manage') then raise exception 'not_authorized'; end if;
  delete from public.user_roles ur using public.roles r
  where ur.role_id = r.id and ur.user_id = target_user and r.code = target_role;
end $$;

revoke all on function public.assign_user_role(uuid,text) from public;
revoke all on function public.remove_user_role(uuid,text) from public;
grant execute on function public.assign_user_role(uuid,text) to authenticated;
grant execute on function public.remove_user_role(uuid,text) to authenticated;

-- Approved or published listings remain owner-locked. An administrator can return
-- either state to changes_requested with a reason; published records immediately
-- leave public queries and must pass submit -> approve -> publish again.
create or replace function public.review_property(target_property uuid, review_action text, review_reason text default null)
returns public.properties language plpgsql security definer set search_path = public as $$
declare current_property public.properties; old_status public.property_status; next_status public.property_status;
begin
  if not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  select * into current_property from public.properties where id = target_property for update;
  if not found then raise exception 'property_not_found'; end if;
  old_status := current_property.status;
  next_status := case review_action
    when 'approve' then 'approved'::public.property_status
    when 'publish' then 'published'::public.property_status
    when 'reject' then 'rejected'::public.property_status
    when 'request_changes' then 'changes_requested'::public.property_status
    when 'archive' then 'archived'::public.property_status
    when 'mark_sold' then 'sold'::public.property_status
    else null end;
  if next_status is null then raise exception 'invalid_action'; end if;
  if (review_action = 'approve' and old_status <> 'pending_review')
    or (review_action = 'publish' and old_status <> 'approved')
    or (review_action = 'reject' and old_status <> 'pending_review')
    or (review_action = 'request_changes' and old_status not in ('pending_review','approved','published'))
    or (review_action in ('archive','mark_sold') and old_status not in ('approved','published')) then raise exception 'invalid_transition'; end if;
  if review_action in ('reject','request_changes') and nullif(trim(review_reason),'') is null then raise exception 'reason_required'; end if;
  update public.properties set status = next_status,
    approved_at = case when review_action='approve' then now() else approved_at end,
    approved_by = case when review_action='approve' then auth.uid() else approved_by end,
    published_at = case when review_action='publish' then now() else published_at end
  where id = target_property returning * into current_property;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,old_status,next_status,auth.uid(),review_reason);
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values)
  values(auth.uid(),'property.'||review_action,'property',current_property.reference_no,jsonb_build_object('status',old_status),jsonb_build_object('status',next_status,'reason',review_reason));
  return current_property;
end $$;

-- A content-free schema probe lets /api/health distinguish connectivity from a
-- database whose application schema is incomplete without leaking table contents.
create or replace function public.is_application_schema_ready()
returns boolean language sql stable security definer set search_path = public as $$
  select
    to_regclass('public.profiles') is not null
    and to_regclass('public.properties') is not null
    and to_regclass('public.property_media') is not null
    and to_regclass('public.enquiries') is not null
    and to_regclass('public.enquiry_notes') is not null
    and to_regclass('public.master_items') is not null
    and to_regclass('public.advertisements') is not null
    and to_regclass('public.notification_outbox') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='properties' and column_name='area_sq_ft'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='properties' and column_name='is_pinned'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='enquiries' and column_name='follow_up_at'
    )
    and to_regprocedure('public.submit_property_for_review(uuid)') is not null
    and to_regprocedure('public.review_property(uuid,text,text)') is not null
$$;
revoke all on function public.is_application_schema_ready() from public;
grant execute on function public.is_application_schema_ready() to anon, authenticated;
