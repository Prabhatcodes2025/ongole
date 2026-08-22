-- Targeted non-Home corrections: role-aware Google onboarding and public property content safety.
-- Forward-only; preserves existing records and RLS.

create or replace function public.claim_new_google_account(
  requested_account_type text,
  accepted_terms_version text
)
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
  if requested_account_type not in ('buyer','owner','agent','pg_owner') then raise exception 'account_type_invalid'; end if;
  if accepted_terms_version <> '2026-08-13' then raise exception 'terms_version_invalid'; end if;

  select created_at into auth_created_at from auth.users where id = auth.uid();
  if auth_created_at is null then raise exception 'auth_user_not_found'; end if;

  if auth_created_at < now() - interval '15 minutes' then
    select * into current_profile from public.profiles where id = auth.uid();
    return current_profile;
  end if;

  update public.profiles
  set account_type = case when account_type = 'buyer' then requested_account_type else account_type end,
      terms_accepted_at = coalesce(terms_accepted_at,now()),
      terms_version = coalesce(terms_version,accepted_terms_version)
  where id = auth.uid()
  returning * into current_profile;

  return current_profile;
end
$$;

revoke all on function public.claim_new_google_account(text,text) from public;
grant execute on function public.claim_new_google_account(text,text) to authenticated;

create or replace function public.enforce_public_property_content()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.title,'') ~* '(test[[:space:]]+property|delete[[:space:]]+after[[:space:]]+uat|dummy[[:space:]]+(property|listing)|sample[[:space:]]+(property|listing)|placeholder[[:space:]]+(property|listing)|\m[b-df-hj-np-tv-z]{7,}\M|<\/?[[:alpha:]][^>]*>|javascript[[:space:]]*:|data[[:space:]]*:[[:space:]]*text/html)' then
    raise exception 'property_title_prohibited_content';
  end if;

  if coalesce(new.description,'') ~* '(<\/?[[:alpha:]][^>]*>|javascript[[:space:]]*:|data[[:space:]]*:[[:space:]]*text/html|test[[:space:]]+property|delete[[:space:]]+after[[:space:]]+uat|insert[[:space:]]+into[[:space:]]+(public\.)?[[:alpha:]_][[:alnum:]_]*|delete[[:space:]]+from[[:space:]]+(public\.)?[[:alpha:]_][[:alnum:]_]*|drop[[:space:]]+table|alter[[:space:]]+table|create[[:space:]]+table|stack[[:space:]]+trace|supabase[[:space:]]+error|debug[[:space:]]*:)' then
    raise exception 'property_description_prohibited_content';
  end if;

  return new;
end
$$;

drop trigger if exists properties_public_content_safety on public.properties;
create trigger properties_public_content_safety
before insert or update of title,description,status on public.properties
for each row execute function public.enforce_public_property_content();

create or replace function public.enforce_public_pg_name()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.pg_name,'') ~* '(test[[:space:]]+property|delete[[:space:]]+after[[:space:]]+uat|dummy[[:space:]]+(property|listing)|sample[[:space:]]+(property|listing)|placeholder[[:space:]]+(property|listing)|\m[b-df-hj-np-tv-z]{7,}\M|<\/?[[:alpha:]][^>]*>|javascript[[:space:]]*:|insert[[:space:]]+into[[:space:]]+(public\.)?[[:alpha:]_][[:alnum:]_]*)' then
    raise exception 'pg_name_prohibited_content';
  end if;
  return new;
end
$$;

drop trigger if exists pg_public_name_safety on public.pg_listings;
create trigger pg_public_name_safety
before insert or update of pg_name on public.pg_listings
for each row execute function public.enforce_public_pg_name();
