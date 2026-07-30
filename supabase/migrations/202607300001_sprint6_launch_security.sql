-- Sprint 6 launch-critical contact entitlement and mobile integrity.
-- Forward-only: preserves the existing contact visibility values and RLS policies.

create or replace function public.get_property_contact(target_property uuid)
returns table(label text, phone text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  property_record public.properties;
  owner_phone text;
  eligible boolean := false;
begin
  select *
  into property_record
  from public.properties
  where id = target_property
    and status = 'published'
    and deleted_at is null;

  if not found then
    return;
  end if;

  if auth.uid() is not null then
    select exists(
      select 1
      from public.subscriptions subscription
      where subscription.user_id = property_record.owner_id
        and subscription.status = 'active'
        and subscription.starts_at <= now()
        and subscription.ends_at > now()
    )
    into eligible;
  end if;

  if property_record.contact_visibility = 'public'
     or (property_record.contact_visibility = 'eligible_members' and eligible)
  then
    select profile.mobile
    into owner_phone
    from public.profiles profile
    where profile.id = property_record.owner_id;
  end if;

  if owner_phone is not null then
    return query select 'Property owner'::text, owner_phone;
  else
    return query select 'OngoleProperty.com'::text, '7788998459'::text;
  end if;
end
$$;

revoke all on function public.get_property_contact(uuid) from public;
grant execute on function public.get_property_contact(uuid) to anon, authenticated;

alter table public.profiles
  add constraint profiles_mobile_quality_check
  check (
    mobile is null
    or (
      mobile ~ '^[6-9][0-9]{9}$'
      and mobile !~ '^([0-9])\1{9}$'
    )
  ) not valid;

alter table public.profiles validate constraint profiles_mobile_quality_check;

create unique index profiles_mobile_unique_idx
  on public.profiles(mobile)
  where mobile is not null;

create or replace function public.is_mobile_available(candidate_mobile text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    candidate_mobile ~ '^[6-9][0-9]{9}$'
    and candidate_mobile !~ '^([0-9])\1{9}$'
    and not exists (
      select 1
      from public.profiles profile
      where profile.mobile = candidate_mobile
        and profile.id is distinct from auth.uid()
    )
$$;

revoke all on function public.is_mobile_available(text) from public;
grant execute on function public.is_mobile_available(text) to anon, authenticated;

create or replace function public.reconcile_current_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
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
  if safe_mobile is not null
     and (
       safe_mobile !~ '^[6-9][0-9]{9}$'
       or safe_mobile ~ '^([0-9])\1{9}$'
     )
  then
    safe_mobile := null;
  end if;

  if safe_mobile is not null
     and exists (
       select 1 from public.profiles profile
       where profile.mobile = safe_mobile
         and profile.id <> auth.uid()
     )
  then
    safe_mobile := null;
  end if;

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
end
$$;

revoke all on function public.reconcile_current_profile() from public;
grant execute on function public.reconcile_current_profile() to authenticated;
