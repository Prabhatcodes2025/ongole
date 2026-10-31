-- Repair Admin property lifecycle operations without weakening content or retention safeguards.
begin;

-- Entitlement consumption is an internal ledger, not a business-record reason to retain the
-- full property. Preserve the ledger and its human reference when a property is deleted.
alter table public.property_posting_uses add column if not exists id uuid default gen_random_uuid();
alter table public.property_posting_uses add column if not exists property_reference text;
update public.property_posting_uses usage
set property_reference=property.reference_no
from public.properties property
where property.id=usage.property_id and usage.property_reference is null;
alter table public.property_posting_uses alter column id set not null;
alter table public.property_posting_uses drop constraint if exists property_posting_uses_pkey;
alter table public.property_posting_uses add constraint property_posting_uses_pkey primary key(id);
drop index if exists public.property_posting_uses_property_unique_idx;
create unique index property_posting_uses_property_unique_idx on public.property_posting_uses(property_id) where property_id is not null;
alter table public.property_posting_uses drop constraint if exists property_posting_uses_property_id_fkey;
alter table public.property_posting_uses alter column property_id drop not null;
alter table public.property_posting_uses add constraint property_posting_uses_property_id_fkey foreign key(property_id) references public.properties(id) on delete set null;

-- Revalidate content only when content actually changes. All original prohibited-content
-- expressions remain byte-for-byte equivalent to the existing safety rules.
create or replace function public.enforce_public_property_content()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if (tg_op='INSERT' or new.title is distinct from old.title) and coalesce(new.title,'') ~* '(test[[:space:]]+property|delete[[:space:]]+after[[:space:]]+uat|dummy[[:space:]]+(property|listing)|sample[[:space:]]+(property|listing)|placeholder[[:space:]]+(property|listing)|\m[b-df-hj-np-tv-z]{7,}\M|<\/?[[:alpha:]][^>]*>|javascript[[:space:]]*:|data[[:space:]]*:[[:space:]]*text/html)' then
    raise exception 'property_title_prohibited_content';
  end if;
  if (tg_op='INSERT' or new.description is distinct from old.description) and coalesce(new.description,'') ~* '(<\/?[[:alpha:]][^>]*>|javascript[[:space:]]*:|data[[:space:]]*:[[:space:]]*text/html|test[[:space:]]+property|delete[[:space:]]+after[[:space:]]+uat|insert[[:space:]]+into[[:space:]]+(public\.)?[[:alpha:]_][[:alnum:]_]*|delete[[:space:]]+from[[:space:]]+(public\.)?[[:alpha:]_][[:alnum:]_]*|drop[[:space:]]+table|alter[[:space:]]+table|create[[:space:]]+table|stack[[:space:]]+trace|supabase[[:space:]]+error|debug[[:space:]]*:)' then
    raise exception 'property_description_prohibited_content';
  end if;
  return new;
end
$$;
drop trigger if exists properties_public_content_safety on public.properties;
create trigger properties_public_content_safety before insert or update of title,description on public.properties for each row execute function public.enforce_public_property_content();

-- Canonical bulk actions. Legacy activate/delete values remain accepted for deployed clients,
-- but audit entries use the unambiguous restore/soft_delete names.
create or replace function public.admin_bulk_property_action(target_properties uuid[],bulk_action text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; property_record public.properties; next_status public.property_status; affected integer:=0; canonical_action text;
begin
  if auth.uid() is null or not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  if bulk_action not in ('publish','archive','restore','soft_delete','activate','delete','deactivate','feature','unfeature','verify','unverify','pin','unpin') then raise exception 'invalid_action'; end if;
  if coalesce(cardinality(target_properties),0)=0 or cardinality(target_properties)>100 then raise exception 'invalid_request'; end if;
  canonical_action:=case bulk_action when 'activate' then 'restore' when 'delete' then 'soft_delete' else bulk_action end;
  foreach target in array target_properties loop
    select * into property_record from public.properties where id=target for update;
    if not found then continue; end if;
    next_status:=property_record.status;
    if canonical_action='publish' then
      if property_record.status<>'approved' or property_record.deleted_at is not null then continue; end if;
      next_status:='published';
    elsif canonical_action in ('archive','deactivate') then
      if property_record.status in ('archived','sold','rented','leased') then continue; end if;
      next_status:='archived';
    elsif canonical_action='restore' then
      if property_record.status<>'archived' then continue; end if;
      next_status:='draft';
    elsif canonical_action='soft_delete' then
      if property_record.deleted_at is not null then continue; end if;
      next_status:='archived';
    end if;
    update public.properties set status=next_status,
      published_at=case when canonical_action='publish' then now() when canonical_action='restore' then null else published_at end,
      expires_at=case when canonical_action='restore' then null else expires_at end,
      deleted_at=case when canonical_action='soft_delete' then now() when canonical_action='restore' then null else deleted_at end,
      is_featured=case when canonical_action='feature' then true when canonical_action='unfeature' then false else is_featured end,
      is_verified=case when canonical_action='verify' then true when canonical_action='unverify' then false else is_verified end,
      is_pinned=case when canonical_action='pin' then true when canonical_action='unpin' then false else is_pinned end
    where id=target;
    if next_status<>property_record.status then insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target,property_record.status,next_status,auth.uid(),'Bulk action: '||canonical_action); end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values)
    values(auth.uid(),'property.bulk_'||canonical_action,'property',property_record.reference_no,jsonb_build_object('status',property_record.status,'deleted_at',property_record.deleted_at),jsonb_build_object('status',next_status,'soft_deleted',canonical_action='soft_delete'));
    affected:=affected+1;
  end loop;
  return affected;
end
$$;

-- Permanent deletion keeps business/financial retention checks. Posting-usage rows and audit
-- logs are preserved independently and therefore do not block deletion.
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
  if exists(select 1 from public.enquiries where property_id=target_property) then raise exception 'retention_required:enquiries'; end if;
  if exists(select 1 from public.promotion_activations where property_id=target_property) then raise exception 'retention_required:promotions'; end if;
  if exists(select 1 from public.payment_orders where metadata->>'property_id'=target_property::text) then raise exception 'retention_required:payments'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.permanent_delete','property',property_record.reference_no,jsonb_build_object('status',property_record.status,'owner_id',property_record.owner_id,'deleted_at',property_record.deleted_at),jsonb_build_object('permanently_deleted',true));
  delete from public.properties where id=target_property;
end
$$;

revoke all on function public.admin_bulk_property_action(uuid[],text) from public,anon,authenticated,service_role;
revoke all on function public.admin_manage_property_deletion(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_bulk_property_action(uuid[],text) to authenticated;
grant execute on function public.admin_manage_property_deletion(uuid,text,text) to authenticated;

commit;
