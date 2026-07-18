-- Production authentication, profile reconciliation and RBAC hotfix.
-- Forward-only and safe after 202607180002_post_sprint3_acceptance.sql.

create or replace function public.reconcile_current_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  claims jsonb := auth.jwt();
  metadata jsonb := coalesce(auth.jwt()->'user_metadata','{}'::jsonb);
  requested_type text;
  safe_mobile text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  requested_type := coalesce(metadata->>'account_type','buyer');
  if requested_type not in ('buyer','owner','agent','pg_owner') then requested_type := 'buyer'; end if;
  safe_mobile := nullif(metadata->>'mobile','');
  if safe_mobile is not null and safe_mobile !~ '^[6-9][0-9]{9}$' then safe_mobile := null; end if;

  insert into public.profiles(id,full_name,email,mobile,account_type,email_verified)
  values(
    auth.uid(),
    left(coalesce(metadata->>'full_name',''),100),
    nullif(claims->>'email','')::citext,
    safe_mobile,
    requested_type,
    true
  )
  on conflict(id) do update set
    email=coalesce(excluded.email,profiles.email),
    full_name=case when profiles.full_name='' then excluded.full_name else profiles.full_name end,
    mobile=coalesce(profiles.mobile,excluded.mobile),
    email_verified=profiles.email_verified or excluded.email_verified
  returning * into current_profile;
  return current_profile;
end $$;

revoke all on function public.reconcile_current_profile() from public;
grant execute on function public.reconcile_current_profile() to authenticated;

create or replace function public.get_current_auth_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'user_id',auth.uid(),
    'profile_status',(select pr.status from public.profiles pr where pr.id=auth.uid()),
    'roles',coalesce((select jsonb_agg(distinct r.code order by r.code) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid()),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(distinct p.code order by p.code) from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=auth.uid()),'[]'::jsonb)
  ) end
$$;

revoke all on function public.get_current_auth_context() from public;
grant execute on function public.get_current_auth_context() to authenticated;

-- RLS policies and SQL grants are both required. These grants expose operations to
-- PostgREST, while the existing RLS policies still decide which rows each caller can use.
grant select on public.profiles,public.roles,public.permissions,public.role_permissions,public.user_roles,
  public.properties,public.property_media,public.property_status_history,public.locations,
  public.property_categories,public.property_types,public.enquiries,public.enquiry_notes,
  public.master_items,public.advertisements,public.audit_logs,public.feature_flags,
  public.website_settings to authenticated;
grant insert,update,delete on public.properties,public.property_media to authenticated;
grant insert,update on public.enquiries to authenticated;
grant insert,update,delete on public.enquiry_notes,public.master_items,public.advertisements to authenticated;
grant insert,update,delete on public.property_categories,public.property_types,public.locations to authenticated;

drop policy if exists property_categories_admin_manage on public.property_categories;
create policy property_categories_admin_manage on public.property_categories for all
using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
drop policy if exists property_types_admin_manage on public.property_types;
create policy property_types_admin_manage on public.property_types for all
using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
drop policy if exists locations_admin_manage on public.locations;
create policy locations_admin_manage on public.locations for all
using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

-- Preserve deliberate restrictions from prior migrations.
revoke update on public.profiles from authenticated;
grant update(full_name,mobile) on public.profiles to authenticated;
revoke insert,update,delete on public.user_roles from authenticated;
revoke select on public.notification_outbox from authenticated;
revoke insert on public.analytics_events from authenticated;

revoke all on function public.submit_property_for_review(uuid) from anon;
revoke all on function public.review_property(uuid,text,text) from anon;
revoke all on function public.owner_soft_delete_property(uuid) from anon;
revoke all on function public.duplicate_owner_property(uuid) from anon;
revoke all on function public.record_audit_event(text,text,text,jsonb,jsonb,text) from anon;
revoke all on function public.admin_bulk_property_action(uuid[],text) from anon;
grant execute on function public.submit_property_for_review(uuid) to authenticated;
grant execute on function public.review_property(uuid,text,text) to authenticated;
grant execute on function public.owner_soft_delete_property(uuid) to authenticated;
grant execute on function public.duplicate_owner_property(uuid) to authenticated;
grant execute on function public.record_audit_event(text,text,text,jsonb,jsonb,text) to authenticated;
grant execute on function public.admin_bulk_property_action(uuid[],text) to authenticated;
