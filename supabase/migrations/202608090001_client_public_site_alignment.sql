-- Client-approved public-site alignment.
-- Forward-only: preserves existing users, agent applications, PG listings and media.

create index if not exists agents_review_queue_idx
  on public.agents(status, created_at desc);

create or replace function public.sync_agent_application_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  metadata jsonb := '{}'::jsonb;
  years_value integer;
  towns text[] := '{}';
  specialties text[] := '{}';
begin
  if new.account_type <> 'agent' then
    return new;
  end if;

  select coalesce(raw_user_meta_data, '{}'::jsonb)
  into metadata
  from auth.users
  where id = new.id;

  if coalesce(metadata->>'years_experience','') ~ '^\d{1,2}$' then
    years_value := least((metadata->>'years_experience')::integer, 80);
  end if;

  if jsonb_typeof(metadata->'working_towns') = 'array' then
    select coalesce(array_agg(left(trim(value), 100)), '{}')
    into towns
    from (
      select value
      from jsonb_array_elements_text(metadata->'working_towns')
      where nullif(trim(value),'') is not null
      limit 5
    ) values_to_store;
  end if;

  if jsonb_typeof(metadata->'specializations') = 'array' then
    select coalesce(array_agg(left(trim(value), 100)), '{}')
    into specialties
    from (
      select value
      from jsonb_array_elements_text(metadata->'specializations')
      where nullif(trim(value),'') is not null
      limit 20
    ) values_to_store;
  end if;

  insert into public.agents(
    user_id, years_experience, office_address, about,
    working_towns, specializations, status
  )
  values(
    new.id,
    years_value,
    nullif(left(trim(coalesce(metadata->>'office_address','')),500),''),
    nullif(left(trim(coalesce(metadata->>'about','')),1500),''),
    towns,
    specialties,
    'pending'
  )
  on conflict(user_id) do nothing;

  return new;
end
$$;

drop trigger if exists profiles_sync_agent_application on public.profiles;
create trigger profiles_sync_agent_application
after insert or update of account_type on public.profiles
for each row execute function public.sync_agent_application_from_profile();

insert into public.agents(user_id, status)
select profile.id, 'pending'
from public.profiles profile
where profile.account_type = 'agent'
on conflict(user_id) do nothing;

drop policy if exists agents_owner_update_pending on public.agents;
create policy agents_owner_update_pending
on public.agents for update to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists agents_admin_manage on public.agents;
create policy agents_admin_manage
on public.agents for all to authenticated
using (public.has_permission('agents.manage'))
with check (public.has_permission('agents.manage'));

grant select(id,reference_no,user_id,years_experience,office_address,about,working_towns,specializations,profile_image_path,status,verified_at,created_at)
on public.agents to anon, authenticated;
grant update(years_experience,office_address,about,working_towns,specializations,profile_image_path)
on public.agents to authenticated;

create or replace function public.review_agent_application(
  target_agent uuid,
  review_action text,
  review_reason text default null
)
returns public.agents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_agent public.agents;
  next_status public.agent_status;
begin
  if not public.has_permission('agents.manage') then
    raise exception 'not_authorized';
  end if;

  select * into current_agent
  from public.agents
  where id = target_agent
  for update;

  if not found then raise exception 'agent_not_found'; end if;
  if current_agent.status <> 'pending' then raise exception 'invalid_transition'; end if;

  next_status := case review_action
    when 'approve' then 'active'::public.agent_status
    when 'reject' then 'rejected'::public.agent_status
    else null
  end;

  if next_status is null then raise exception 'invalid_action'; end if;
  if review_action = 'reject' and nullif(trim(review_reason),'') is null then
    raise exception 'reason_required';
  end if;

  update public.agents
  set status = next_status,
      verified_by = case when review_action='approve' then auth.uid() else null end,
      verified_at = case when review_action='approve' then now() else null end
  where id = target_agent
  returning * into current_agent;

  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'agent.'||review_action,'agent',current_agent.reference_no,
    jsonb_build_object('status',next_status,'reason',review_reason));

  return current_agent;
end
$$;

revoke all on function public.review_agent_application(uuid,text,text) from public;
grant execute on function public.review_agent_application(uuid,text,text) to authenticated;

create or replace function public.enforce_locked_pg_content()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  description_value text := coalesce(new.description,'');
begin
  if coalesce(new.details->>'listing_kind','') <> 'paying_guest' then
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.description is distinct from old.description
     or (new.status = 'pending_review' and old.status is distinct from new.status)
  then
    if array_length(regexp_split_to_array(trim(description_value),'\s+'),1) > 250 then
      raise exception 'pg_description_word_limit';
    end if;
    if description_value ~* '<[^>]+>' then raise exception 'pg_description_plain_text_only'; end if;
    if description_value ~* '(\m[6-9][0-9]{9}\M|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|https?://|www\.|(^|[[:space:]])@[[:alnum:]_.]+|follow[[:space:]]+us|limited[[:space:]]+offer|book[[:space:]]+now|\m(fuck|shit|bitch|bastard)\M)' then
      raise exception 'pg_description_prohibited_content';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists properties_locked_pg_content on public.properties;
create trigger properties_locked_pg_content
before insert or update of description,status on public.properties
for each row execute function public.enforce_locked_pg_content();

create or replace function public.enforce_locked_pg_listing()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  video text;
begin
  if new.category not in ('mens','womens','co_living') then
    raise exception 'invalid_pg_category';
  end if;

  foreach video in array coalesce(new.video_urls,'{}') loop
    if video !~* '^https?://(www\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[A-Za-z0-9_-]{6,}' then
      raise exception 'invalid_pg_video_url';
    end if;
  end loop;

  if tg_op = 'INSERT' or new.security_deposit is distinct from old.security_deposit then
    new.security_deposit := null;
  end if;
  return new;
end
$$;

drop trigger if exists pg_listings_locked_requirements on public.pg_listings;
create trigger pg_listings_locked_requirements
before insert or update on public.pg_listings
for each row execute function public.enforce_locked_pg_listing();

create or replace function public.enforce_locked_pg_room()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.security_deposit is distinct from old.security_deposit then
    new.security_deposit := null;
  end if;
  return new;
end
$$;

drop trigger if exists pg_rooms_locked_requirements on public.pg_room_types;
create trigger pg_rooms_locked_requirements
before insert or update on public.pg_room_types
for each row execute function public.enforce_locked_pg_room();

create or replace function public.enforce_pg_image_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.media_type = 'image'
     and exists(
       select 1 from public.pg_listings pg where pg.property_id = new.property_id
     )
     and (
       select count(*) from public.property_media media
       where media.property_id = new.property_id and media.media_type = 'image'
     ) >= 6
  then
    raise exception 'pg_image_limit_reached';
  end if;
  return new;
end
$$;

drop trigger if exists property_media_pg_limit on public.property_media;
create trigger property_media_pg_limit
before insert on public.property_media
for each row execute function public.enforce_pg_image_limit();
