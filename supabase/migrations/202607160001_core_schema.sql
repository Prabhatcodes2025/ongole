-- OngoleProperty.com core PostgreSQL schema
-- Apply with the Supabase CLI after reviewing in a staging project.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_status as enum ('pending','active','suspended','blocked');
create type public.property_status as enum ('draft','pending_review','changes_requested','approved','published','rejected','archived','sold','rented','leased');
create type public.enquiry_status as enum ('new','contacted','qualified','visit_scheduled','negotiating','closed','spam');
create type public.agent_status as enum ('pending','verified','active','suspended','blocked','rejected');
create type public.payment_status as enum ('pending','verified','rejected','refunded');

create sequence public.property_reference_seq start 1;
create sequence public.enquiry_reference_seq start 1;
create sequence public.agent_reference_seq start 1;

create or replace function public.make_reference(prefix text, sequence_value bigint)
returns text language sql immutable as $$
  select prefix || '-' || extract(year from current_date)::int || '-' || lpad(sequence_value::text, 6, '0')
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  reference_no text not null unique default public.make_reference('USER', nextval('public.property_reference_seq')),
  full_name text not null default '',
  email citext,
  mobile text check (mobile is null or mobile ~ '^[6-9][0-9]{9}$'),
  account_type text not null default 'buyer' check (account_type in ('buyer','owner','agent','pg_owner','admin')),
  status public.user_status not null default 'active',
  email_verified boolean not null default false,
  mobile_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  description text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid() and p.code = required_permission and pr.status = 'active'
  )
$$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations(id),
  type text not null check (type in ('state','district','municipality','mandal','town','village','locality')),
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  unique (parent_id, slug)
);

create table public.property_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.property_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.property_categories(id),
  name text not null,
  slug text not null unique,
  field_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique default public.make_reference('PROP', nextval('public.property_reference_seq')),
  owner_id uuid not null references public.profiles(id),
  category_id uuid references public.property_categories(id),
  property_type_id uuid references public.property_types(id),
  transaction_type text not null check (transaction_type in ('sale','rent','lease')),
  title text not null check (char_length(title) between 10 and 120),
  description text not null default '',
  slug text unique,
  slug_locked boolean not null default false,
  status public.property_status not null default 'draft',
  location_id uuid references public.locations(id),
  locality_text text not null,
  city_text text not null default 'Ongole',
  district_text text not null default 'Prakasam',
  state_text text not null default 'Andhra Pradesh',
  latitude numeric(9,6),
  longitude numeric(9,6),
  price_inr numeric(14,2) check (price_inr is null or price_inr >= 0),
  area_value numeric(14,4) check (area_value is null or area_value > 0),
  area_unit text check (area_unit in ('sq_ft','sq_yd','sq_m','acre','cent','gunta','hectare')),
  details jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  is_premium boolean not null default false,
  contact_visibility text not null default 'company' check (contact_visibility in ('company','eligible_members','public')),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index properties_public_search_idx on public.properties(status, transaction_type, category_id, property_type_id, location_id) where deleted_at is null;
create index properties_owner_idx on public.properties(owner_id, status, updated_at desc);
create index properties_price_idx on public.properties(price_inr) where status = 'published' and deleted_at is null;
create index properties_details_gin_idx on public.properties using gin(details);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'image' check (media_type in ('image','video','document')),
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  width integer,
  height integer,
  blurhash text,
  alt_text text,
  is_cover boolean not null default false,
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','ready','failed','quarantined')),
  variants jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index one_property_cover_idx on public.property_media(property_id) where is_cover and media_type = 'image';

create table public.property_status_history (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  from_status public.property_status,
  to_status public.property_status not null,
  changed_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique default public.make_reference('ENQ', nextval('public.enquiry_reference_seq')),
  property_id uuid references public.properties(id),
  name text not null check (char_length(name) between 2 and 100),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email citext,
  message text not null default '',
  status public.enquiry_status not null default 'new',
  assigned_to uuid references public.profiles(id),
  source text not null default 'website',
  attribution jsonb not null default '{}'::jsonb,
  privacy_safe_ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enquiries_queue_idx on public.enquiries(status, assigned_to, created_at desc);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique default public.make_reference('AGENT', nextval('public.agent_reference_seq')),
  user_id uuid not null unique references public.profiles(id),
  years_experience integer check (years_experience between 0 and 80),
  office_address text,
  about text,
  working_towns text[] not null default '{}',
  specializations text[] not null default '{}',
  profile_image_path text,
  verification_document_paths text[] not null default '{}',
  status public.agent_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (cardinality(working_towns) <= 5)
);

create table public.pg_listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references public.properties(id) on delete cascade,
  pg_name text not null,
  category text not null check (category in ('mens','womens','family','co_living')),
  rent_per_bed numeric(12,2) not null,
  room_type text,
  security_deposit numeric(12,2),
  capacity integer,
  food_type text,
  details jsonb not null default '{}'::jsonb
);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  duration_days integer not null check (duration_days > 0),
  price_inr numeric(12,2) not null default 0,
  benefits jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.membership_plans(id),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null check (status in ('pending','active','expired','cancelled')),
  activated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  membership_id uuid references public.memberships(id),
  method text not null check (method in ('cash','bank_transfer','qr','other')),
  amount_inr numeric(12,2) not null check (amount_inr >= 0),
  reference text,
  proof_path text,
  status public.payment_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.seo_overrides (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  title text,
  description text,
  canonical_url text,
  robots jsonb not null default '{"index":true,"follow":true}'::jsonb,
  open_graph jsonb not null default '{}'::jsonb,
  structured_data jsonb not null default '{}'::jsonb,
  is_locked boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(entity_type, entity_id)
);

create table public.url_history (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  old_path text not null unique,
  new_path text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  created_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.website_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_reference text,
  old_values jsonb,
  new_values jsonb,
  privacy_safe_ip_hash text,
  user_agent text,
  request_id uuid not null default gen_random_uuid(),
  outcome text not null default 'success',
  created_at timestamptz not null default now()
);
create index audit_lookup_idx on public.audit_logs(entity_type, entity_reference, created_at desc);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  session_hash text,
  user_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_event_rollup_idx on public.analytics_events(event_type, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger properties_updated before update on public.properties for each row execute function public.set_updated_at();
create trigger enquiries_updated before update on public.enquiries for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, mobile, account_type, email_verified)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, new.raw_user_meta_data->>'mobile', coalesce(new.raw_user_meta_data->>'account_type','buyer'), new.email_confirmed_at is not null);
  return new;
end $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.enqueue_enquiry_email() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_outbox(event_type, recipient, payload)
  values ('enquiry.created', coalesce(current_setting('app.admin_notification_email', true), 'admin@ongoleproperty.com'), jsonb_build_object('enquiry_id',new.id,'reference_no',new.reference_no,'property_id',new.property_id));
  return new;
end $$;
create trigger enquiry_email_outbox after insert on public.enquiries for each row execute function public.enqueue_enquiry_email();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.locations enable row level security;
alter table public.property_categories enable row level security;
alter table public.property_types enable row level security;
alter table public.properties enable row level security;
alter table public.property_media enable row level security;
alter table public.property_status_history enable row level security;
alter table public.enquiries enable row level security;
alter table public.agents enable row level security;
alter table public.pg_listings enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.seo_overrides enable row level security;
alter table public.url_history enable row level security;
alter table public.feature_flags enable row level security;
alter table public.website_settings enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_logs enable row level security;
alter table public.analytics_events enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.has_permission('users.read'));
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy roles_admin_read on public.roles for select using (public.has_permission('roles.manage'));
create policy permissions_admin_read on public.permissions for select using (public.has_permission('roles.manage'));
create policy role_permissions_admin_read on public.role_permissions for select using (public.has_permission('roles.manage'));
create policy user_roles_self_read on public.user_roles for select using (user_id = auth.uid() or public.has_permission('roles.manage'));
create policy user_roles_admin_manage on public.user_roles for all using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));
create policy master_locations_public on public.locations for select using (is_active or public.has_permission('settings.manage'));
create policy master_categories_public on public.property_categories for select using (is_active or public.has_permission('settings.manage'));
create policy master_types_public on public.property_types for select using (is_active or public.has_permission('settings.manage'));
create policy properties_public_read on public.properties for select using ((status = 'published' and deleted_at is null) or owner_id = auth.uid() or public.has_permission('properties.read'));
create policy properties_owner_insert on public.properties for insert with check (owner_id = auth.uid() and status = 'draft');
create policy properties_owner_update_draft on public.properties for update using (owner_id = auth.uid() and status in ('draft','changes_requested')) with check (owner_id = auth.uid() and status in ('draft','pending_review'));
create policy properties_admin_all on public.properties for all using (public.has_permission('properties.manage')) with check (public.has_permission('properties.manage'));
create policy media_property_read on public.property_media for select using (exists (select 1 from public.properties p where p.id = property_id and (p.status = 'published' or p.owner_id = auth.uid() or public.has_permission('properties.read'))));
create policy media_owner_manage on public.property_media for all using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid() and p.status in ('draft','changes_requested'))) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid() and p.status in ('draft','changes_requested')));
create policy enquiry_public_insert on public.enquiries for insert with check (status = 'new' and assigned_to is null);
create policy enquiry_admin_read on public.enquiries for select using (public.has_permission('enquiries.read'));
create policy enquiry_admin_manage on public.enquiries for update using (public.has_permission('enquiries.manage'));
create policy agents_public_read on public.agents for select using ((status = 'active' and verified_at is not null) or user_id = auth.uid() or public.has_permission('agents.read'));
create policy pg_public_read on public.pg_listings for select using (exists (select 1 from public.properties p where p.id = property_id and (p.status = 'published' or p.owner_id = auth.uid() or public.has_permission('properties.read'))));
create policy flags_public_read on public.feature_flags for select using (true);
create policy settings_public_read on public.website_settings for select using (is_public or public.has_permission('settings.manage'));
create policy memberships_self_read on public.memberships for select using (user_id = auth.uid() or public.has_permission('users.read'));
create policy payments_self_read on public.payments for select using (user_id = auth.uid() or public.has_permission('users.read'));
create policy plans_admin_manage on public.membership_plans for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy memberships_admin_manage on public.memberships for all using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));
create policy payments_admin_manage on public.payments for all using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));
create policy seo_admin_manage on public.seo_overrides for all using (public.has_permission('seo.manage')) with check (public.has_permission('seo.manage'));
create policy redirects_admin_manage on public.url_history for all using (public.has_permission('seo.manage')) with check (public.has_permission('seo.manage'));
create policy flags_admin_manage on public.feature_flags for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy settings_admin_manage on public.website_settings for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy audit_admin_read on public.audit_logs for select using (public.has_permission('audit.read'));
create policy analytics_insert on public.analytics_events for insert with check (true);
create policy analytics_admin_read on public.analytics_events for select using (public.has_permission('analytics.read'));

revoke update, delete on public.audit_logs from authenticated, anon;
revoke select on public.notification_outbox from authenticated, anon;

create or replace function public.get_property_contact(target_property uuid)
returns table(label text, phone text) language plpgsql stable security definer set search_path = public as $$
declare p public.properties; owner_phone text; eligible boolean := false;
begin
  select * into p from public.properties where id = target_property and status = 'published' and deleted_at is null;
  if not found then return; end if;
  if auth.uid() is not null then
    select exists(select 1 from public.memberships m where m.user_id = p.owner_id and m.status = 'active' and m.expires_at > now()) into eligible;
  end if;
  if p.contact_visibility = 'public' or (p.contact_visibility = 'eligible_members' and eligible) then
    select mobile into owner_phone from public.profiles where id = p.owner_id;
  end if;
  if owner_phone is not null then return query select 'Property owner'::text, owner_phone;
  else return query select 'OngoleProperty.com'::text, '7788998459'::text;
  end if;
end $$;

create or replace function public.submit_property_for_review(target_property uuid)
returns public.properties language plpgsql security definer set search_path = public as $$
declare current_property public.properties; old_status public.property_status;
begin
  select * into current_property from public.properties where id = target_property for update;
  if current_property.owner_id <> auth.uid() then raise exception 'not_authorized'; end if;
  if current_property.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
  if char_length(current_property.description) < 40 or current_property.price_inr is null or current_property.area_value is null then raise exception 'property_incomplete'; end if;
  old_status := current_property.status;
  update public.properties set status = 'pending_review', submitted_at = now() where id = target_property returning * into current_property;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by) values(target_property,old_status,'pending_review',auth.uid());
  return current_property;
end $$;

create or replace function public.review_property(target_property uuid, review_action text, review_reason text default null)
returns public.properties language plpgsql security definer set search_path = public as $$
declare current_property public.properties; old_status public.property_status; next_status public.property_status;
begin
  if not public.has_permission('properties.manage') then raise exception 'not_authorized'; end if;
  select * into current_property from public.properties where id = target_property for update;
  if not found then raise exception 'property_not_found'; end if;
  old_status := current_property.status;
  next_status := case review_action
    when 'approve' then 'approved'::public.property_status
    when 'publish' then 'published'::public.property_status
    when 'reject' then 'rejected'::public.property_status
    when 'request_changes' then 'changes_requested'::public.property_status
    when 'archive' then 'archived'::public.property_status
    when 'mark_sold' then 'sold'::public.property_status
    else null end;
  if next_status is null then raise exception 'invalid_action'; end if;
  if (review_action = 'approve' and old_status <> 'pending_review')
    or (review_action = 'publish' and old_status <> 'approved')
    or (review_action in ('reject','request_changes') and old_status <> 'pending_review')
    or (review_action in ('archive','mark_sold') and old_status not in ('approved','published')) then raise exception 'invalid_transition'; end if;
  if review_action in ('reject','request_changes') and nullif(trim(review_reason),'') is null then raise exception 'reason_required'; end if;
  update public.properties set status = next_status,
    approved_at = case when review_action='approve' then now() else approved_at end,
    approved_by = case when review_action='approve' then auth.uid() else approved_by end,
    published_at = case when review_action='publish' then now() else published_at end
  where id = target_property returning * into current_property;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason) values(target_property,old_status,next_status,auth.uid(),review_reason);
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values)
  values(auth.uid(),'property.'||review_action,'property',current_property.reference_no,jsonb_build_object('status',old_status),jsonb_build_object('status',next_status,'reason',review_reason));
  return current_property;
end $$;
