-- Sprint 6 Phase 1: preserve email-only notification preferences while keeping
-- the notification delivery queue linked to durable content.

alter table public.notifications
  add column if not exists is_in_app_visible boolean not null default true;

alter table public.notification_deliveries
  add column if not exists processing_started_at timestamptz;

alter table public.notification_outbox
  add column if not exists processing_started_at timestamptz;

drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select
using (
  (user_id = auth.uid() and is_in_app_visible)
  or public.has_permission('notifications.manage')
);

drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update
using (
  user_id = auth.uid() and is_in_app_visible
)
with check (
  user_id = auth.uid() and is_in_app_visible
);

create or replace function public.create_notification(
  target_user uuid,
  notification_event text,
  notification_title text,
  notification_body text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_url text default null,
  event_data jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result uuid;
  preference public.notification_preferences;
  in_app_enabled boolean;
  email_enabled boolean;
begin
  select *
    into preference
    from public.notification_preferences
   where user_id = target_user
     and event_type = notification_event;

  in_app_enabled := preference.user_id is null or preference.in_app_enabled;
  email_enabled := preference.user_id is null or preference.email_enabled;

  if not in_app_enabled and not email_enabled then
    return null;
  end if;

  insert into public.notifications(
    user_id,
    event_type,
    title,
    body,
    entity_type,
    entity_id,
    action_url,
    data,
    is_in_app_visible
  )
  values(
    target_user,
    notification_event,
    left(notification_title, 180),
    left(notification_body, 2000),
    target_entity_type,
    target_entity_id,
    target_url,
    coalesce(event_data, '{}'),
    in_app_enabled
  )
  returning id into result;

  if in_app_enabled then
    insert into public.notification_deliveries(notification_id, channel, status)
    values(result, 'in_app', 'sent');
  end if;

  if email_enabled then
    insert into public.notification_deliveries(notification_id, channel, status)
    values(result, 'email', 'queued');
  end if;

  return result;
exception
  when others then
    return null;
end
$$;

create index if not exists notifications_visible_user_created_idx
  on public.notifications(user_id, created_at desc)
  where is_in_app_visible;

create index if not exists notification_deliveries_processing_idx
  on public.notification_deliveries(processing_started_at)
  where status = 'processing';

create index if not exists notification_outbox_processing_idx
  on public.notification_outbox(processing_started_at)
  where status = 'processing';

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  update public.notifications notification
     set read_at = now()
   where notification.user_id = auth.uid()
     and notification.is_in_app_visible
     and notification.read_at is null;

  get diagnostics affected = row_count;
  return affected;
end
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, uuid, text, jsonb) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
