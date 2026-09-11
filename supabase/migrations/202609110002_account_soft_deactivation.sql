-- Recoverable account deactivation. Existing auth, listings and business history are retained.
alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists deactivation_reason text;

create or replace function public.deactivate_current_account(confirmed_email text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare account_email citext; account_confirmed timestamptz; profile_type text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select email,email_confirmed_at into account_email,account_confirmed from auth.users where id=auth.uid();
  select account_type into profile_type from public.profiles where id=auth.uid() for update;
  if account_confirmed is null or account_email is null or lower(trim(confirmed_email))<>lower(account_email::text) then raise exception 'confirmation_failed'; end if;
  if profile_type='admin' then raise exception 'administrator_support_required'; end if;
  update public.profiles set status='blocked',deactivated_at=now(),deactivation_reason='self_deactivated',updated_at=now() where id=auth.uid();
  perform public.record_audit_event('account.self_deactivate','profile',auth.uid()::text,null,jsonb_build_object('recoverable',true));
end $$;

create or replace function public.reactivate_current_account()
returns boolean language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare account_confirmed timestamptz; changed integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select email_confirmed_at into account_confirmed from auth.users where id=auth.uid();
  if account_confirmed is null then raise exception 'verified_email_required'; end if;
  update public.profiles set status='active',deactivated_at=null,deactivation_reason=null,updated_at=now()
    where id=auth.uid() and status='blocked' and deactivated_at is not null and deactivation_reason='self_deactivated';
  get diagnostics changed=row_count;
  if changed>0 then perform public.record_audit_event('account.self_reactivate','profile',auth.uid()::text,jsonb_build_object('status','blocked'),jsonb_build_object('status','active')); end if;
  return changed>0;
end $$;

revoke all on function public.deactivate_current_account(text) from public,anon;
revoke all on function public.reactivate_current_account() from public,anon;
grant execute on function public.deactivate_current_account(text) to authenticated;
grant execute on function public.reactivate_current_account() to authenticated;
