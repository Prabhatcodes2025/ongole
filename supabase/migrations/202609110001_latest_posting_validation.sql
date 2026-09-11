-- Align the already-applied posting workflow with the latest 20-character description rule.
create or replace function public.submit_property_for_review(target_property uuid)
returns public.properties language plpgsql security definer set search_path=public,pg_temp as $$
declare current_property public.properties; old_status public.property_status;
begin
  select * into current_property from public.properties where id=target_property and owner_id=auth.uid() for update;
  if not found then raise exception 'not_authorized'; end if;
  if current_property.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
  if char_length(current_property.description) not between 20 and 250 or current_property.price_inr is null or current_property.area_value is null then raise exception 'property_incomplete'; end if;
  perform public.consume_property_posting_permission(target_property);
  perform public.flag_possible_owner_duplicate(target_property);
  old_status:=current_property.status;
  update public.properties set status='pending_review',submitted_at=now() where id=target_property returning * into current_property;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by) values(target_property,old_status,'pending_review',auth.uid());
  return current_property;
end $$;

create or replace function public.submit_pg_for_review(target_pg uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare pg_record public.pg_listings; property_record public.properties; room_count integer;
begin
  select pg.* into pg_record from public.pg_listings pg join public.properties p on p.id=pg.property_id where pg.id=target_pg and p.owner_id=auth.uid() for update of pg;
  if not found then raise exception 'not_authorized'; end if;
  select * into strict property_record from public.properties where id=pg_record.property_id and owner_id=auth.uid() for update;
  if property_record.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
  select count(*) into room_count from public.pg_room_types where pg_listing_id=target_pg;
  if char_length(property_record.description) not between 20 and 250 or char_length(pg_record.address_line)<5 or room_count=0 then raise exception 'pg_incomplete'; end if;
  perform public.consume_property_posting_permission(property_record.id);
  perform public.flag_possible_owner_duplicate(property_record.id);
  update public.properties set status='pending_review',submitted_at=now() where id=property_record.id;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(property_record.id,property_record.status,'pending_review',auth.uid(),'PG submitted for review');
  return jsonb_build_object('id',target_pg,'property_id',property_record.id,'status','pending_review');
end $$;

revoke all on function public.submit_property_for_review(uuid) from public,anon;
revoke all on function public.submit_pg_for_review(uuid) from public,anon;
grant execute on function public.submit_property_for_review(uuid) to authenticated;
grant execute on function public.submit_pg_for_review(uuid) to authenticated;
