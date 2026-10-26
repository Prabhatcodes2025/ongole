-- Final additive Admin safety and performance repair. Review before production use.
begin;

create index if not exists properties_admin_queue_idx on public.properties(status,deleted_at,updated_at desc);
create index if not exists agents_admin_queue_idx on public.agents(status,created_at desc);
create index if not exists profiles_admin_created_idx on public.profiles(created_at desc);

create or replace function public.admin_manage_property_deletion(target_property uuid,deletion_action text,confirmation_text text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare property_record public.properties; is_super_admin boolean; expected_confirmation text;
begin
  if auth.uid() is null or not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  if deletion_action not in ('soft_delete','restore','permanent_delete') then raise exception 'invalid_action'; end if;
  select * into property_record from public.properties where id=target_property for update;
  if not found then raise exception 'property_not_found'; end if;
  if exists(select 1 from public.pg_listings where property_id=target_property) then raise exception 'pg_workflow_required'; end if;
  expected_confirmation:=case when deletion_action='permanent_delete' then 'DELETE '||property_record.reference_no else property_record.reference_no end;
  if confirmation_text is distinct from expected_confirmation then raise exception 'confirmation_mismatch'; end if;
  if deletion_action='soft_delete' then
    if property_record.deleted_at is not null then raise exception 'already_deleted'; end if;
    update public.properties set deleted_at=now(),status='archived' where id=target_property;
    if property_record.status<>'archived' then insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,property_record.status,'archived',auth.uid(),'Administrator archived property'); end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.soft_delete','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'deleted_at',property_record.deleted_at),jsonb_build_object('status','archived','deleted_at',now()));return;
  end if;
  if deletion_action='restore' then
    if property_record.deleted_at is null then raise exception 'not_deleted'; end if;
    update public.properties set deleted_at=null,status='draft',published_at=null,expires_at=null where id=target_property;
    insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,property_record.status,'draft',auth.uid(),'Administrator restored archived property for re-review');
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.restore','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'deleted_at',property_record.deleted_at),jsonb_build_object('status','draft','deleted_at',null));return;
  end if;
  select exists(select 1 from public.user_roles assignment join public.roles role on role.id=assignment.role_id where assignment.user_id=auth.uid() and role.code='super_admin') into is_super_admin;
  if not is_super_admin then raise exception 'super_admin_required'; end if;
  if property_record.deleted_at is null or property_record.status<>'archived' then raise exception 'soft_delete_required'; end if;
  if exists(select 1 from public.enquiries where property_id=target_property)
    or exists(select 1 from public.promotion_activations where property_id=target_property)
    or exists(select 1 from public.property_posting_uses where property_id=target_property)
    or exists(select 1 from public.payment_orders where metadata->>'property_id'=target_property::text)
  then raise exception 'retention_required'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.permanent_delete','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'owner_id',property_record.owner_id,'deleted_at',property_record.deleted_at),jsonb_build_object('permanently_deleted',true));
  delete from public.properties where id=target_property;
end;
$$;

create or replace function public.admin_permanently_delete_enquiry(target_enquiry uuid,confirmation_text text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare enquiry_record public.enquiries; is_super_admin boolean;
begin
  if auth.uid() is null or not public.has_permission('enquiries.manage') then raise exception 'not_authorized'; end if;
  select exists(select 1 from public.user_roles assignment join public.roles role on role.id=assignment.role_id where assignment.user_id=auth.uid() and role.code='super_admin') into is_super_admin;
  if not is_super_admin then raise exception 'super_admin_required'; end if;
  select * into enquiry_record from public.enquiries where id=target_enquiry for update;
  if not found then raise exception 'enquiry_not_found'; end if;
  if enquiry_record.archived_at is null then raise exception 'archive_required'; end if;
  if confirmation_text is distinct from 'DELETE '||enquiry_record.reference_no then raise exception 'confirmation_mismatch'; end if;
  -- Identified, property-linked and recent records are business/legal records, not disposable test data.
  if enquiry_record.user_id is not null or enquiry_record.property_id is not null or enquiry_record.created_at>now()-interval '365 days' or enquiry_record.status::text not in ('spam','lost') then raise exception 'retention_required'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'enquiry.permanent_delete','enquiry',enquiry_record.reference_no,jsonb_build_object('status',enquiry_record.status,'created_at',enquiry_record.created_at,'archived_at',enquiry_record.archived_at),jsonb_build_object('permanently_deleted',true));
  delete from public.enquiries where id=target_enquiry;
end;
$$;

create or replace function public.admin_manage_pg_deletion(target_pg uuid,deletion_action text,confirmation_text text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pg_record public.pg_listings; property_record public.properties; is_super_admin boolean; expected_confirmation text;
begin
  if auth.uid() is null or not public.has_permission('pg.manage') then raise exception 'not_authorized'; end if;
  if deletion_action not in ('soft_delete','restore','permanent_delete') then raise exception 'invalid_action'; end if;
  select * into pg_record from public.pg_listings where id=target_pg;
  if not found then raise exception 'pg_not_found'; end if;
  select * into property_record from public.properties where id=pg_record.property_id for update;
  expected_confirmation:=case when deletion_action='permanent_delete' then 'DELETE '||property_record.reference_no else property_record.reference_no end;
  if confirmation_text is distinct from expected_confirmation then raise exception 'confirmation_mismatch'; end if;
  if deletion_action='soft_delete' then
    if property_record.deleted_at is not null then raise exception 'already_deleted'; end if;
    update public.properties set deleted_at=now(),status='archived' where id=property_record.id;
    if property_record.status<>'archived' then insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(property_record.id,property_record.status,'archived',auth.uid(),'Administrator archived PG listing'); end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'pg.soft_delete','pg',property_record.reference_no,jsonb_build_object('status','archived','deleted_at',now()));return;
  end if;
  if deletion_action='restore' then
    if property_record.deleted_at is null then raise exception 'not_deleted'; end if;
    update public.properties set deleted_at=null,status='draft',published_at=null,expires_at=null where id=property_record.id;
    insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(property_record.id,property_record.status,'draft',auth.uid(),'Administrator restored PG listing for re-review');
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'pg.restore','pg',property_record.reference_no,jsonb_build_object('status','draft','deleted_at',null));return;
  end if;
  select exists(select 1 from public.user_roles assignment join public.roles role on role.id=assignment.role_id where assignment.user_id=auth.uid() and role.code='super_admin') into is_super_admin;
  if not is_super_admin then raise exception 'super_admin_required'; end if;
  if property_record.deleted_at is null or property_record.status<>'archived' then raise exception 'soft_delete_required'; end if;
  if exists(select 1 from public.enquiries where property_id=property_record.id)
    or exists(select 1 from public.promotion_activations where property_id=property_record.id)
    or exists(select 1 from public.property_posting_uses where property_id=property_record.id)
    or exists(select 1 from public.payment_orders where metadata->>'property_id'=property_record.id::text)
  then raise exception 'retention_required'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'pg.permanent_delete','pg',property_record.reference_no,jsonb_build_object('owner_id',property_record.owner_id,'deleted_at',property_record.deleted_at),jsonb_build_object('permanently_deleted',true));
  delete from public.properties where id=property_record.id;
end;
$$;

revoke all on function public.admin_manage_property_deletion(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_permanently_delete_enquiry(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_manage_pg_deletion(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_manage_property_deletion(uuid,text,text) to authenticated;
grant execute on function public.admin_permanently_delete_enquiry(uuid,text) to authenticated;
grant execute on function public.admin_manage_pg_deletion(uuid,text,text) to authenticated;
commit;
