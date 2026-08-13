-- Targeted registration repair: Terms evidence, Google owner onboarding and agent profile creation.
-- Forward-only; preserves existing users, RLS policies and privileged role assignment controls.

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_account_type text;
  safe_mobile text;
  accepted_at timestamptz;
  accepted_version text;
begin
  requested_account_type := coalesce(new.raw_user_meta_data->>'account_type','buyer');
  if requested_account_type not in ('buyer','owner','agent','pg_owner') then requested_account_type := 'buyer'; end if;
  accepted_version := nullif(new.raw_user_meta_data->>'terms_version','');
  if coalesce(new.raw_user_meta_data->>'terms_accepted_at','') ~ '^\d{4}-\d{2}-\d{2}T' then
    begin accepted_at := (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
    exception when others then accepted_at := null;
    end;
  end if;
  -- Direct Supabase sign-up cannot create an owner/agent profile while bypassing
  -- the application Terms acceptance gate.
  if requested_account_type <> 'buyer' and (accepted_at is null or accepted_version <> '2026-08-13') then
    requested_account_type := 'buyer';
  end if;
  safe_mobile := nullif(new.raw_user_meta_data->>'mobile','');
  if safe_mobile is not null and (
    safe_mobile !~ '^[6-9][0-9]{9}$'
    or safe_mobile ~ '^([0-9])\1{9}$'
    or safe_mobile ~ '^([0-9]{2})\1{4}$'
    or safe_mobile ~ '^([0-9]{5})\1$'
  ) then safe_mobile := null; end if;

  insert into public.profiles(id,full_name,email,mobile,account_type,email_verified,terms_accepted_at,terms_version)
  values(
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name',''),100),
    new.email,
    safe_mobile,
    requested_account_type,
    new.email_confirmed_at is not null,
    accepted_at,
    accepted_version
  );

  if requested_account_type = 'agent' then
    insert into public.agents(user_id,years_experience,office_address,about,working_towns,specializations,status)
    values(
      new.id,
      nullif(new.raw_user_meta_data->>'years_experience','')::integer,
      nullif(new.raw_user_meta_data->>'office_address',''),
      nullif(new.raw_user_meta_data->>'about',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'working_towns','[]'::jsonb)) limit 5),'{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'specializations','[]'::jsonb)) limit 20),'{}'::text[]),
      'pending'
    ) on conflict(user_id) do nothing;
  end if;
  return new;
end
$$;

create or replace function public.claim_new_google_owner(accepted_terms_version text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  auth_created_at timestamptz;
  current_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if accepted_terms_version <> '2026-08-13' then raise exception 'terms_version_invalid'; end if;

  select created_at into auth_created_at from auth.users where id = auth.uid();
  if auth_created_at < now() - interval '15 minutes' then
    select * into current_profile from public.profiles where id = auth.uid();
    return current_profile;
  end if;

  update public.profiles
  set account_type = case when account_type = 'buyer' then 'owner' else account_type end,
      terms_accepted_at = coalesce(terms_accepted_at,now()),
      terms_version = coalesce(terms_version,accepted_terms_version)
  where id = auth.uid()
  returning * into current_profile;
  return current_profile;
end
$$;

revoke all on function public.claim_new_google_owner(text) from public;
grant execute on function public.claim_new_google_owner(text) to authenticated;

alter table public.profiles drop constraint if exists profiles_mobile_quality_check;
alter table public.profiles add constraint profiles_mobile_quality_check check (
  mobile is null or (
    mobile ~ '^[6-9][0-9]{9}$'
    and mobile !~ '^([0-9])\1{9}$'
    and mobile !~ '^([0-9]{2})\1{4}$'
    and mobile !~ '^([0-9]{5})\1$'
  )
) not valid;
alter table public.profiles validate constraint profiles_mobile_quality_check;

create or replace function public.is_mobile_available(candidate_mobile text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select candidate_mobile ~ '^[6-9][0-9]{9}$'
    and candidate_mobile !~ '^([0-9])\1{9}$'
    and candidate_mobile !~ '^([0-9]{2})\1{4}$'
    and candidate_mobile !~ '^([0-9]{5})\1$'
    and not exists (
      select 1 from public.profiles profile
      where profile.mobile = candidate_mobile and profile.id is distinct from auth.uid()
    )
$$;

revoke all on function public.is_mobile_available(text) from public;
grant execute on function public.is_mobile_available(text) to anon, authenticated;

-- Contact/NRI enquiries support either a validated Indian number or an E.164-style
-- international number. Existing Indian records remain valid.
alter table public.enquiries drop constraint if exists enquiries_mobile_check;
alter table public.enquiries add constraint enquiries_mobile_check check (
  mobile ~ '^[6-9][0-9]{9}$' or mobile ~ '^\+[1-9][0-9]{6,14}$'
) not valid;
alter table public.enquiries validate constraint enquiries_mobile_check;
