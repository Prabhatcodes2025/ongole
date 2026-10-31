-- Make PG bulk moderation honor pg.manage without weakening property authorization.
begin;

create or replace function public.admin_bulk_pg_action(target_pgs uuid[],bulk_action text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; pg_record public.pg_listings; property_record public.properties; next_status public.property_status; affected integer:=0;
begin
  if auth.uid() is null or not public.has_permission('pg.manage') then raise exception 'not_authorized'; end if;
  if bulk_action not in ('publish','archive','activate','feature','unfeature','verify','unverify','pin','unpin') then raise exception 'invalid_action'; end if;
  if coalesce(cardinality(target_pgs),0)=0 or cardinality(target_pgs)>100 then raise exception 'invalid_request'; end if;
  foreach target in array target_pgs loop
    select * into pg_record from public.pg_listings where id=target;
    if not found then continue; end if;
    select * into property_record from public.properties where id=pg_record.property_id for update;
    if not found then continue; end if;
    next_status:=property_record.status;
    if bulk_action='publish' and property_record.status='approved' then next_status:='published';
    elsif bulk_action='archive' and property_record.status not in ('archived','sold','rented','leased') then next_status:='archived';
    elsif bulk_action='activate' and property_record.status='archived' then next_status:='draft'; end if;
    update public.properties set status=next_status,
      published_at=case when bulk_action='publish' and property_record.status='approved' then now() else published_at end,
      deleted_at=case when bulk_action='activate' then null else deleted_at end,
      is_featured=case when bulk_action='feature' then true when bulk_action='unfeature' then false else is_featured end,
      is_verified=case when bulk_action='verify' then true when bulk_action='unverify' then false else is_verified end,
      is_pinned=case when bulk_action='pin' then true when bulk_action='unpin' then false else is_pinned end
    where id=property_record.id;
    if next_status<>property_record.status then
      insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason)
      values(property_record.id,property_record.status,next_status,auth.uid(),'PG bulk action: '||bulk_action);
    end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values)
    values(auth.uid(),'pg.bulk_'||bulk_action,'pg',property_record.reference_no,jsonb_build_object('status',property_record.status),jsonb_build_object('status',next_status));
    affected:=affected+1;
  end loop;
  return affected;
end;
$$;

revoke all on function public.admin_bulk_pg_action(uuid[],text) from public,anon,authenticated,service_role;
grant execute on function public.admin_bulk_pg_action(uuid[],text) to authenticated;

commit;
