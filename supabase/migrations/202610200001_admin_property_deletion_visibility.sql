-- Additive Admin visibility and property-retention controls. Review before production use.
begin;

-- Existing Admin roles were created before the agent module permissions existed.
insert into public.role_permissions(role_id,permission_id)
select role.id,permission.id
from public.roles role cross join public.permissions permission
where role.code='admin' and permission.code in ('agents.read','agents.manage')
on conflict do nothing;

-- Repair only confirmed Auth identities that have no profile. Existing profile data is never overwritten.
insert into public.profiles(id,full_name,email,mobile,account_type,email_verified)
select auth_user.id,
  left(coalesce(auth_user.raw_user_meta_data->>'full_name',''),100),
  auth_user.email::citext,
  case when auth_user.raw_user_meta_data->>'mobile' ~ '^[6-9][0-9]{9}$'
    and not exists(select 1 from public.profiles existing where existing.mobile=auth_user.raw_user_meta_data->>'mobile')
    then auth_user.raw_user_meta_data->>'mobile' else null end,
  case when auth_user.raw_user_meta_data->>'account_type' in ('buyer','owner','agent','pg_owner') then auth_user.raw_user_meta_data->>'account_type' else 'buyer' end,
  true
from auth.users auth_user
where auth_user.email_confirmed_at is not null
  and not exists(select 1 from public.profiles existing where existing.id=auth_user.id)
on conflict(id) do nothing;

create or replace function public.admin_manage_property_deletion(target_property uuid,deletion_action text,confirmation_text text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare property_record public.properties; is_super_admin boolean;
begin
  if auth.uid() is null or not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  if deletion_action not in ('soft_delete','restore','permanent_delete') then raise exception 'invalid_action'; end if;
  select * into property_record from public.properties where id=target_property for update;
  if not found then raise exception 'property_not_found'; end if;
  if exists(select 1 from public.pg_listings where property_id=target_property) then raise exception 'pg_workflow_required'; end if;
  if confirmation_text<>(case when deletion_action='permanent_delete' then 'DELETE '||property_record.reference_no else property_record.reference_no end) then raise exception 'confirmation_mismatch'; end if;

  if deletion_action='soft_delete' then
    if property_record.deleted_at is not null then raise exception 'already_deleted'; end if;
    update public.properties set deleted_at=now(),status='archived' where id=target_property;
    if property_record.status<>'archived' then insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,property_record.status,'archived',auth.uid(),'Administrator soft deleted property'); end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.soft_delete','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'deleted_at',property_record.deleted_at),jsonb_build_object('status','archived','deleted_at',now()));
    return;
  end if;

  if deletion_action='restore' then
    if property_record.deleted_at is null then raise exception 'not_deleted'; end if;
    update public.properties set deleted_at=null,status='draft',published_at=null,expires_at=null where id=target_property;
    insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,property_record.status,'draft',auth.uid(),'Administrator restored soft-deleted property for re-review');
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.restore','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'deleted_at',property_record.deleted_at),jsonb_build_object('status','draft','deleted_at',null));
    return;
  end if;

  select exists(select 1 from public.user_roles assignment join public.roles role on role.id=assignment.role_id where assignment.user_id=auth.uid() and role.code='super_admin') into is_super_admin;
  if not is_super_admin then raise exception 'super_admin_required'; end if;
  if property_record.deleted_at is null or property_record.status<>'archived' then raise exception 'soft_delete_required'; end if;
  if exists(select 1 from public.enquiries where property_id=target_property)
    or exists(select 1 from public.promotion_activations where property_id=target_property)
    or exists(select 1 from public.property_posting_uses where property_id=target_property) then raise exception 'retention_required'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values)
  values(auth.uid(),'property.permanent_delete','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'owner_id',property_record.owner_id,'deleted_at',property_record.deleted_at),jsonb_build_object('permanently_deleted',true));
  delete from public.properties where id=target_property;
end;
$$;

revoke all on function public.admin_manage_property_deletion(uuid,text,text) from public,anon;
grant execute on function public.admin_manage_property_deletion(uuid,text,text) to authenticated;

commit;
