-- Authenticated property posting, one-account entitlement, approval/live validity and expiry.
alter type public.property_status add value if not exists 'expired' after 'published';

alter table public.profiles add column if not exists communication_consent jsonb not null default '{"email":true,"whatsapp":false,"sms":false,"phone_call":false}'::jsonb;
create or replace function public.capture_registration_communication_consent()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare consent jsonb;
begin
  select raw_user_meta_data->'communication_consent' into consent from auth.users where id=new.id;
  if jsonb_typeof(consent)='object' then
    new.communication_consent:=jsonb_build_object('email',coalesce((consent->>'email')::boolean,false),'whatsapp',coalesce((consent->>'whatsapp')::boolean,false),'sms',coalesce((consent->>'sms')::boolean,false),'phone_call',coalesce((consent->>'phone_call')::boolean,false));
  end if;
  return new;
end $$;
drop trigger if exists profiles_capture_communication_consent on public.profiles;
create trigger profiles_capture_communication_consent before insert on public.profiles for each row execute function public.capture_registration_communication_consent();

create table if not exists public.property_posting_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now()
);
create index if not exists property_posting_grants_user_idx on public.property_posting_grants(user_id,granted_at);

create table if not exists public.property_posting_uses (
  property_id uuid primary key references public.properties(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consumed_at timestamptz not null default now()
);
create index if not exists property_posting_uses_user_idx on public.property_posting_uses(user_id,consumed_at);

alter table public.property_posting_grants enable row level security;
alter table public.property_posting_uses enable row level security;
drop policy if exists property_posting_grants_admin_read on public.property_posting_grants;
create policy property_posting_grants_admin_read on public.property_posting_grants for select using(public.has_permission('users.read'));
drop policy if exists property_posting_uses_owner_read on public.property_posting_uses;
create policy property_posting_uses_owner_read on public.property_posting_uses for select using(user_id=auth.uid() or public.has_permission('users.read'));
grant select on public.property_posting_grants,public.property_posting_uses to authenticated;

insert into public.property_posting_uses(property_id,user_id,consumed_at)
select p.id,p.owner_id,coalesce(p.submitted_at,p.published_at,p.created_at)
from public.properties p
where p.submitted_at is not null or p.status in ('pending_review','approved','published','expired','sold','rented','leased')
on conflict(property_id) do nothing;

drop trigger if exists properties_plan_limit_before_insert on public.properties;
drop trigger if exists properties_publish_plan_before_update on public.properties;
create unique index if not exists properties_owner_client_draft_key_idx
  on public.properties(owner_id,(details->>'client_draft_key'))
  where details ? 'client_draft_key' and deleted_at is null;

create or replace function public.check_property_posting_permission()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare used_count integer; grant_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select count(*) into used_count from public.property_posting_uses where user_id=auth.uid();
  select count(*) into grant_count from public.property_posting_grants where user_id=auth.uid();
  return jsonb_build_object('allowed',used_count < 1+grant_count,'consumed',used_count,'limit',1+grant_count,'additional_permissions',grant_count);
end $$;

create or replace function public.grant_one_property_permission(target_user uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
  if not public.has_permission('users.manage') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.profiles where id=target_user) then raise exception 'user_not_found'; end if;
  insert into public.property_posting_grants(user_id,granted_by) values(target_user,auth.uid()) returning id into result;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'property_permission.grant_one','user',target_user::text,jsonb_build_object('grant_id',result,'quantity',1));
  return result;
end $$;

create or replace function public.consume_property_posting_permission(target_property uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare property_owner uuid; used_count integer; grant_count integer;
begin
  select owner_id into property_owner from public.properties where id=target_property for update;
  if property_owner is null or property_owner<>auth.uid() then raise exception 'not_authorized'; end if;
  if exists(select 1 from public.property_posting_uses where property_id=target_property) then return; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select count(*) into used_count from public.property_posting_uses where user_id=auth.uid();
  select count(*) into grant_count from public.property_posting_grants where user_id=auth.uid();
  if used_count>=1+grant_count then raise exception 'PROPERTY_POSTING_LIMIT_REACHED'; end if;
  insert into public.property_posting_uses(property_id,user_id) values(target_property,auth.uid());
end $$;

create or replace function public.flag_possible_owner_duplicate(target_property uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate public.properties; duplicate_found boolean;
begin
  select * into candidate from public.properties where id=target_property and owner_id=auth.uid();
  if not found then raise exception 'not_authorized'; end if;
  select exists(select 1 from public.properties other
    where other.id<>candidate.id and other.owner_id=candidate.owner_id and other.deleted_at is null
      and other.status in ('pending_review','approved','published','expired')
      and lower(trim(other.locality_text))=lower(trim(candidate.locality_text))
      and other.category_id is not distinct from candidate.category_id
      and other.property_type_id is not distinct from candidate.property_type_id) into duplicate_found;
  update public.properties set details=jsonb_set(details,'{possible_duplicate}',to_jsonb(duplicate_found),true) where id=target_property;
  return duplicate_found;
end $$;

create or replace function public.submit_property_for_review(target_property uuid)
returns public.properties language plpgsql security definer set search_path=public,pg_temp as $$
declare current_property public.properties; old_status public.property_status;
begin
  select * into current_property from public.properties where id=target_property and owner_id=auth.uid() for update;
  if not found then raise exception 'not_authorized'; end if;
  if current_property.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
  if char_length(current_property.description)<40 or current_property.price_inr is null or current_property.area_value is null then raise exception 'property_incomplete'; end if;
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
  if char_length(property_record.description)<40 or char_length(pg_record.address_line)<5 or room_count=0 then raise exception 'pg_incomplete'; end if;
  perform public.consume_property_posting_permission(property_record.id);
  perform public.flag_possible_owner_duplicate(property_record.id);
  update public.properties set status='pending_review',submitted_at=now() where id=property_record.id;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(property_record.id,property_record.status,'pending_review',auth.uid(),'PG submitted for review');
  return jsonb_build_object('id',target_pg,'property_id',property_record.id,'status','pending_review');
end $$;

create or replace function public.review_property(target_property uuid,review_action text,review_reason text default null)
returns public.properties language plpgsql security definer set search_path=public,pg_temp as $$
declare current_property public.properties; old_status public.property_status; next_status public.property_status;
begin
  if not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  select * into current_property from public.properties where id=target_property for update;if not found then raise exception 'property_not_found'; end if;
  old_status:=current_property.status;
  next_status:=case review_action when 'approve' then 'published'::public.property_status when 'publish' then 'published'::public.property_status when 'renew' then 'published'::public.property_status when 'reject' then 'rejected'::public.property_status when 'request_changes' then 'changes_requested'::public.property_status when 'archive' then 'archived'::public.property_status when 'mark_sold' then 'sold'::public.property_status else null end;
  if next_status is null then raise exception 'invalid_action'; end if;
  if (review_action='approve' and old_status<>'pending_review') or (review_action='publish' and old_status<>'approved') or (review_action='renew' and old_status<>'expired') or (review_action='reject' and old_status<>'pending_review') or (review_action='request_changes' and old_status not in ('pending_review','approved','published')) or (review_action in ('archive','mark_sold') and old_status not in ('approved','published','expired')) then raise exception 'invalid_transition'; end if;
  if review_action in ('reject','request_changes') and nullif(trim(review_reason),'') is null then raise exception 'reason_required'; end if;
  update public.properties set status=next_status,
    approved_at=case when review_action='approve' then now() else approved_at end,
    approved_by=case when review_action='approve' then auth.uid() else approved_by end,
    published_at=case when review_action in ('approve','publish','renew') then now() else published_at end,
    expires_at=case when review_action in ('approve','publish','renew') then now()+interval '1 month' else expires_at end
  where id=target_property returning * into current_property;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,old_status,next_status,auth.uid(),coalesce(review_reason,case when review_action='renew' then 'Offline renewal' end));
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'property.'||review_action,'property',current_property.reference_no,jsonb_build_object('status',old_status),jsonb_build_object('status',next_status,'expires_at',current_property.expires_at,'reason',review_reason));
  return current_property;
end $$;

create or replace function public.expire_live_properties()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer;
begin
  update public.properties set status='expired' where status='published' and expires_at<=now() and deleted_at is null;
  get diagnostics affected=row_count;return affected;
end $$;

create or replace function public.get_property_contact(target_property uuid)
returns table(label text,phone text) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare property_record public.properties;owner_phone text;eligible boolean:=false;
begin
  select * into property_record from public.properties where id=target_property and status in ('published','expired') and deleted_at is null;if not found then return;end if;
  if property_record.status='expired' then return query select 'OngoleProperty.com - contact us for latest availability'::text,'7788998459'::text;return;end if;
  if auth.uid() is not null then select exists(select 1 from public.subscriptions s where s.user_id=property_record.owner_id and s.status='active' and s.starts_at<=now() and s.ends_at>now()) into eligible;end if;
  if property_record.contact_visibility='public' or (property_record.contact_visibility='eligible_members' and eligible) then select mobile into owner_phone from public.profiles where id=property_record.owner_id;end if;
  if owner_phone is not null then return query select 'Property owner'::text,owner_phone;else return query select 'OngoleProperty.com'::text,'7788998459'::text;end if;
end $$;

drop policy if exists properties_public_read on public.properties;
create policy properties_public_read on public.properties for select using((status in ('published','expired') and deleted_at is null) or owner_id=auth.uid() or public.has_permission('properties.read'));

revoke all on function public.check_property_posting_permission() from public,anon;
revoke all on function public.grant_one_property_permission(uuid) from public,anon;
revoke all on function public.consume_property_posting_permission(uuid) from public,anon;
revoke all on function public.flag_possible_owner_duplicate(uuid) from public,anon;
revoke all on function public.expire_live_properties() from public,anon;
grant execute on function public.check_property_posting_permission() to authenticated;
grant execute on function public.grant_one_property_permission(uuid) to authenticated;
grant execute on function public.submit_property_for_review(uuid) to authenticated;
grant execute on function public.submit_pg_for_review(uuid) to authenticated;
grant execute on function public.review_property(uuid,text,text) to authenticated;
grant execute on function public.get_property_contact(uuid) to anon,authenticated;
grant execute on function public.expire_live_properties() to service_role;
