-- Phase 1 property alerts. Publish enqueues work atomically; external FCM delivery never runs in a transaction.
create table public.property_alert_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  permission_status text not null default 'default' check (permission_status in ('default','granted','denied','unsupported','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_alert_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('sale','rent','lease')),
  category_slug text,
  property_type_slug text,
  locations text[] not null default '{}',
  min_budget numeric(14,2) check (min_budget >= 0),
  max_budget numeric(14,2) check (max_budget >= 0),
  min_area_sq_ft numeric(18,4) check (min_area_sq_ft >= 0),
  max_area_sq_ft numeric(18,4) check (max_area_sq_ft >= 0),
  bedrooms integer check (bedrooms between 0 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_budget is null or max_budget is null or min_budget <= max_budget),
  check (min_area_sq_ft is null or max_area_sq_ft is null or min_area_sq_ft <= max_area_sq_ft),
  check (cardinality(locations) <= 5)
);
create index property_alert_requirements_active_idx on public.property_alert_requirements(id) where active;
create index property_alert_requirements_user_idx on public.property_alert_requirements(user_id,created_at desc);

create table public.push_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  fcm_token text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id,device_id)
);
create index push_registrations_active_user_idx on public.push_registrations(user_id) where active;

create table public.push_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','complete','failed')),
  cursor_id uuid,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index push_publish_jobs_due_idx on public.push_publish_jobs(status,next_attempt_at);

create table public.push_notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  requirement_id uuid references public.property_alert_requirements(id) on delete set null,
  registration_id uuid references public.push_registrations(id) on delete set null,
  notification_type text not null check (notification_type in ('property_match','manual_property','general')),
  title text not null,
  body text not null,
  action_path text not null check (action_path like '/%' and action_path not like '//%'),
  image_path text,
  dedupe_key text not null unique,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);
create index push_notification_logs_due_idx on public.push_notification_logs(status,next_attempt_at);
create index push_notification_logs_user_recent_idx on public.push_notification_logs(user_id,created_at desc);
create index push_notification_logs_property_idx on public.push_notification_logs(property_id,created_at desc);

alter table public.property_alert_preferences enable row level security;
alter table public.property_alert_requirements enable row level security;
alter table public.push_registrations enable row level security;
alter table public.push_publish_jobs enable row level security;
alter table public.push_notification_logs enable row level security;

create policy property_alert_preferences_owner on public.property_alert_preferences for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy property_alert_requirements_owner on public.property_alert_requirements for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy push_registrations_owner_read on public.push_registrations for select to authenticated
  using (user_id=auth.uid());
create policy push_notification_logs_owner_read on public.push_notification_logs for select to authenticated
  using (user_id=auth.uid() or public.has_permission('notifications.manage'));

revoke all on public.property_alert_preferences,public.property_alert_requirements,
  public.push_registrations,public.push_publish_jobs,public.push_notification_logs from public,anon,authenticated;
grant select,insert,update on public.property_alert_preferences to authenticated;
grant select,insert,update,delete on public.property_alert_requirements to authenticated;
grant select on public.push_registrations,public.push_notification_logs to authenticated;
grant all on public.property_alert_preferences,public.property_alert_requirements,
  public.push_registrations,public.push_publish_jobs,public.push_notification_logs to service_role;

create or replace function public.enqueue_first_property_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.status <> 'published' and new.status = 'published' and old.published_at is null
     and new.published_at is not null and new.deleted_at is null then
    insert into public.push_publish_jobs(property_id) values(new.id) on conflict(property_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.enqueue_first_property_push() from public,anon,authenticated;
drop trigger if exists properties_first_publish_push on public.properties;
create trigger properties_first_publish_push after update of status on public.properties
  for each row execute function public.enqueue_first_property_push();
