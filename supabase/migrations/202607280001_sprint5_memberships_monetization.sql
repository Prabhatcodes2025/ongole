-- Sprint 5: memberships, payments, monetization, notifications and analytics.
-- Forward-only. Legacy membership tables remain intact for compatibility.

insert into public.permissions(code,module,description) values
  ('plans.read','billing','View subscription plans'),
  ('plans.manage','billing','Create and manage subscription plans'),
  ('subscriptions.read','billing','View subscriptions'),
  ('subscriptions.manage','billing','Activate, pause and cancel subscriptions'),
  ('payments.read','finance','View payments and invoices'),
  ('payments.manage','finance','Manage and reconcile payments'),
  ('refunds.manage','finance','Create and manage refunds'),
  ('promotions.read','monetization','View promotion products and activations'),
  ('promotions.manage','monetization','Manage promotion products and activations'),
  ('reports.read','reports','View and export reports'),
  ('notifications.manage','notifications','Manage notification templates and deliveries')
on conflict(code) do nothing;

insert into public.roles(code,name,description,is_system) values
  ('admin','Administrator','General platform administrator',true),
  ('pg_manager','PG Manager','Review and manage paying guest listings',true),
  ('finance_manager','Finance Manager','Manage subscriptions, payments and refunds',true),
  ('support_manager','Support Manager','Support users, subscriptions and notifications',true),
  ('read_only_admin','Read-only Administrator','Read operational and financial data',true)
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where
  r.code='super_admin'
  or (r.code='admin' and p.code in ('properties.read','properties.manage','pg.read','pg.manage','enquiries.read','enquiries.manage','users.read','plans.read','subscriptions.read','payments.read','promotions.read','analytics.read','reports.read','audit.read'))
  or (r.code='property_manager' and p.code in ('plans.read','subscriptions.read','promotions.read','analytics.read','reports.read'))
  or (r.code='pg_manager' and p.code in ('pg.read','pg.manage','enquiries.read','plans.read','subscriptions.read','promotions.read','analytics.read','reports.read','audit.read'))
  or (r.code='finance_manager' and p.code in ('users.read','plans.read','plans.manage','subscriptions.read','subscriptions.manage','payments.read','payments.manage','refunds.manage','promotions.read','promotions.manage','analytics.read','reports.read','audit.read'))
  or (r.code='support_manager' and p.code in ('users.read','enquiries.read','enquiries.manage','plans.read','subscriptions.read','payments.read','notifications.manage','audit.read'))
  or (r.code='read_only_admin' and p.code in ('properties.read','pg.read','enquiries.read','users.read','plans.read','subscriptions.read','payments.read','promotions.read','analytics.read','reports.read','audit.read'))
on conflict do nothing;

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(name) between 2 and 80),
  slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  billing_period text not null check(billing_period in ('free','monthly','quarterly','half_yearly','yearly','custom')),
  billing_interval_months integer not null default 1 check(billing_interval_months between 0 and 120),
  price numeric(12,2) not null default 0 check(price>=0),
  currency char(3) not null default 'INR',
  is_active boolean not null default true,
  is_public boolean not null default true,
  listing_limit integer not null default 1 check(listing_limit>=0),
  pg_listing_limit integer not null default 0 check(pg_listing_limit>=0),
  image_limit_per_listing integer not null default 5 check(image_limit_per_listing between 0 and 100),
  featured_listing_allowance integer not null default 0 check(featured_listing_allowance>=0),
  verified_listing_allowance integer not null default 0 check(verified_listing_allowance>=0),
  listing_duration_days integer not null default 90 check(listing_duration_days between 1 and 3650),
  enquiry_access boolean not null default true,
  analytics_access boolean not null default false,
  priority_support boolean not null default false,
  display_order integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_public_idx on public.plans(is_active,is_public,display_order);

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_code text not null check(feature_code ~ '^[a-z0-9_.-]+$'),
  feature_name text not null,
  enabled boolean not null default true,
  limit_value integer,
  configuration jsonb not null default '{}',
  display_order integer not null default 0,
  unique(plan_id,feature_code)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.plans(id),
  status text not null check(status in ('trialing','active','past_due','paused','cancelled','expired')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  renewal_at timestamptz,
  cancelled_at timestamptz,
  provider text not null default 'manual' check(provider in ('free','manual','razorpay','custom')),
  provider_subscription_id text,
  auto_renew boolean not null default false,
  activated_by uuid references public.profiles(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
create unique index subscriptions_provider_id_idx on public.subscriptions(provider,provider_subscription_id) where provider_subscription_id is not null;
create index subscriptions_user_active_idx on public.subscriptions(user_id,status,ends_at desc);

create table public.subscription_usage (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  property_listings integer not null default 0,
  pg_listings integer not null default 0,
  images integer not null default 0,
  featured_activations integer not null default 0,
  verified_activations integer not null default 0,
  enquiries_accessed integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(subscription_id,period_start)
);

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index subscription_events_lookup_idx on public.subscription_events(subscription_id,created_at desc);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid references public.plans(id),
  promotion_product_id uuid,
  amount numeric(12,2) not null check(amount>=0),
  currency char(3) not null default 'INR',
  provider text not null check(provider in ('razorpay','manual','custom')),
  provider_order_id text,
  status text not null default 'created' check(status in ('created','pending','authorized','captured','failed','refunded','partially_refunded','cancelled')),
  idempotency_key uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}',
  expires_at timestamptz not null default(now()+interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_order_id),
  unique(user_id,idempotency_key),
  check((plan_id is not null)::integer+(promotion_product_id is not null)::integer=1)
);
create index payment_orders_user_idx on public.payment_orders(user_id,created_at desc);

do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='status' and udt_name='payment_status') then
    alter table public.payments rename column status to legacy_status;
  end if;
end $$;
alter table public.payments
  add column if not exists order_id uuid references public.payment_orders(id),
  add column if not exists subscription_id uuid references public.subscriptions(id),
  add column if not exists plan_id uuid references public.plans(id),
  add column if not exists provider text not null default 'manual',
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  add column if not exists status text not null default 'pending',
  add column if not exists currency char(3) not null default 'INR',
  add column if not exists payment_method text,
  add column if not exists failure_reason text,
  add column if not exists captured_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}';
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check(status in ('created','pending','authorized','captured','failed','refunded','partially_refunded','cancelled'));
create unique index if not exists payments_provider_payment_idx on public.payments(provider,provider_payment_id) where provider_payment_id is not null;
create index if not exists payments_user_created_idx on public.payments(user_id,created_at desc);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  order_id uuid references public.payment_orders(id) on delete cascade,
  transaction_type text not null check(transaction_type in ('order_created','authorized','captured','failed','refund','adjustment')),
  amount numeric(12,2) not null check(amount>=0),
  currency char(3) not null default 'INR',
  provider_reference text,
  status text not null,
  raw_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check(payment_id is not null or order_id is not null)
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_hash text not null,
  payload_hash text not null,
  status text not null default 'received' check(status in ('received','processing','processed','ignored','failed')),
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique(provider,provider_event_id)
);

create sequence if not exists public.invoice_number_seq;
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default public.make_reference('INV',nextval('public.invoice_number_seq')),
  user_id uuid not null references public.profiles(id),
  payment_id uuid not null unique references public.payments(id),
  subscription_id uuid references public.subscriptions(id),
  subtotal numeric(12,2) not null,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  currency char(3) not null default 'INR',
  billing_details jsonb not null default '{}',
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  status text not null default 'paid' check(status in ('draft','issued','paid','void','refunded')),
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  user_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check(amount>0),
  currency char(3) not null default 'INR',
  provider_refund_id text,
  status text not null default 'pending' check(status in ('pending','processing','completed','failed','cancelled')),
  reason text not null,
  requested_by uuid not null references public.profiles(id),
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.plans(id),
  transaction_reference text not null,
  payment_date date not null,
  payment_mode text not null check(payment_mode in ('cash','bank_transfer','upi','qr','cheque','other')),
  amount numeric(12,2) not null check(amount>0),
  currency char(3) not null default 'INR',
  proof_path text,
  note text,
  status text not null default 'pending' check(status in ('pending','clarification_requested','approved','rejected')),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  payment_id uuid references public.payments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,transaction_reference)
);
create index manual_payment_queue_idx on public.manual_payment_requests(status,created_at);

create table public.promotion_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  promotion_type text not null check(promotion_type in ('featured','verified','pinned','homepage','search_boost','urgent')),
  duration_days integer not null check(duration_days between 1 and 365),
  price numeric(12,2) not null check(price>=0),
  currency char(3) not null default 'INR',
  eligible_listing_type text not null check(eligible_listing_type in ('property','pg','both')),
  placement text not null default 'listing',
  is_active boolean not null default true,
  display_order integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_orders add constraint payment_orders_promotion_product_fkey foreign key(promotion_product_id) references public.promotion_products(id);

create table public.promotion_activations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.promotion_products(id),
  property_id uuid not null references public.properties(id),
  user_id uuid not null references public.profiles(id),
  payment_id uuid references public.payments(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check(status in ('scheduled','active','expired','cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
create index promotion_active_listing_idx on public.promotion_activations(property_id,status,ends_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  action_url text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications(user_id,read_at,created_at desc);

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,event_type)
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel text not null check(channel in ('in_app','email','whatsapp','sms')),
  subject_template text,
  body_template text not null,
  is_active boolean not null default true,
  version integer not null default 1,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_type,channel,version)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  channel text not null check(channel in ('in_app','email','whatsapp','sms')),
  recipient text,
  status text not null default 'queued' check(status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  provider_reference text,
  error_code text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_delivery_queue_idx on public.notification_deliveries(status,next_attempt_at);

create table public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  owner_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  event_count bigint not null default 0,
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create unique index analytics_daily_identity_idx on public.analytics_daily(day,coalesce(owner_id,'00000000-0000-0000-0000-000000000000'::uuid),entity_type,coalesce(entity_id,'00000000-0000-0000-0000-000000000000'::uuid),event_type);
create index analytics_daily_owner_idx on public.analytics_daily(owner_id,day desc,event_type);

insert into public.plans(name,slug,description,billing_period,billing_interval_months,price,listing_limit,pg_listing_limit,image_limit_per_listing,featured_listing_allowance,verified_listing_allowance,listing_duration_days,enquiry_access,analytics_access,priority_support,display_order) values
  ('Free','free','Start with one property listing.','free',0,0,1,0,5,0,0,60,true,false,false,10),
  ('Basic','basic','Essential tools for individual owners.','monthly',1,499,3,1,10,0,0,90,true,false,false,20),
  ('Professional','professional','Advanced tools and analytics for active owners.','monthly',1,1499,10,5,20,2,1,180,true,true,true,30),
  ('Premium','premium','Maximum visibility for professional portfolios.','monthly',1,2999,30,15,30,5,3,365,true,true,true,40),
  ('Custom','custom','Custom limits and support for large portfolios.','custom',1,0,100,50,50,20,20,3650,true,true,true,50)
on conflict(slug) do nothing;

insert into public.plan_features(plan_id,feature_code,feature_name,enabled,display_order)
select p.id,f.code,f.name,case when f.code='analytics' then p.analytics_access when f.code='priority_support' then p.priority_support else true end,f.sort from public.plans p cross join (values
  ('public_listing','Public listings',true,10),('enquiries','Enquiry access',true,20),
  ('analytics','Owner analytics',false,30),('priority_support','Priority support',false,40)
) as f(code,name,enabled,sort)
on conflict(plan_id,feature_code) do nothing;

insert into public.promotion_products(name,slug,promotion_type,duration_days,price,eligible_listing_type,placement,display_order) values
  ('Featured Property','featured-property','featured',30,999,'property','search',10),
  ('Featured PG','featured-pg','featured',30,999,'pg','search',20),
  ('Verified Property','verified-property','verified',365,1499,'property','listing',30),
  ('Verified PG','verified-pg','verified',365,1499,'pg','listing',40),
  ('Pinned Listing','pinned-listing','pinned',14,799,'both','search',50),
  ('Homepage Promotion','homepage-promotion','homepage',7,1999,'both','homepage',60),
  ('Search Boost','search-boost','search_boost',14,599,'both','search',70),
  ('Urgent Badge','urgent-badge','urgent',14,399,'both','listing',80)
on conflict(slug) do nothing;

do $$ declare t text; begin
  foreach t in array array['plans','plan_features','subscriptions','subscription_usage','subscription_events','payment_orders','payment_transactions','payment_webhook_events','invoices','refunds','manual_payment_requests','promotion_products','promotion_activations','notifications','notification_preferences','notification_templates','notification_deliveries','analytics_daily'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

create policy plans_public_read on public.plans for select using ((is_active and is_public) or public.has_permission('plans.read'));
create policy plans_admin_manage on public.plans for all using(public.has_permission('plans.manage')) with check(public.has_permission('plans.manage'));
create policy plan_features_public_read on public.plan_features for select using(exists(select 1 from public.plans p where p.id=plan_id and p.is_active and p.is_public) or public.has_permission('plans.read'));
create policy plan_features_admin_manage on public.plan_features for all using(public.has_permission('plans.manage')) with check(public.has_permission('plans.manage'));
create policy subscriptions_self_read on public.subscriptions for select using(user_id=auth.uid() or public.has_permission('subscriptions.read'));
create policy subscriptions_admin_manage on public.subscriptions for all using(public.has_permission('subscriptions.manage')) with check(public.has_permission('subscriptions.manage'));
create policy subscription_usage_self_read on public.subscription_usage for select using(exists(select 1 from public.subscriptions s where s.id=subscription_id and (s.user_id=auth.uid() or public.has_permission('subscriptions.read'))));
create policy subscription_usage_admin_manage on public.subscription_usage for all using(public.has_permission('subscriptions.manage')) with check(public.has_permission('subscriptions.manage'));
create policy subscription_events_self_read on public.subscription_events for select using(exists(select 1 from public.subscriptions s where s.id=subscription_id and (s.user_id=auth.uid() or public.has_permission('subscriptions.read'))));
create policy payment_orders_self_read on public.payment_orders for select using(user_id=auth.uid() or public.has_permission('payments.read'));
create policy payment_orders_self_insert on public.payment_orders for insert with check(user_id=auth.uid() and status='created');
create policy payment_orders_admin_manage on public.payment_orders for all using(public.has_permission('payments.manage')) with check(public.has_permission('payments.manage'));

drop policy if exists payments_self_read on public.payments;
drop policy if exists payments_admin_manage on public.payments;
create policy payments_self_read on public.payments for select using(user_id=auth.uid() or public.has_permission('payments.read'));
create policy payments_admin_manage on public.payments for all using(public.has_permission('payments.manage')) with check(public.has_permission('payments.manage'));
create policy payment_transactions_self_read on public.payment_transactions for select using(
  exists(select 1 from public.payments p where p.id=payment_id and (p.user_id=auth.uid() or public.has_permission('payments.read')))
  or exists(select 1 from public.payment_orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_permission('payments.read')))
);
create policy webhook_admin_read on public.payment_webhook_events for select using(public.has_permission('payments.read'));
create policy invoices_self_read on public.invoices for select using(user_id=auth.uid() or public.has_permission('payments.read'));
create policy invoices_admin_manage on public.invoices for all using(public.has_permission('payments.manage')) with check(public.has_permission('payments.manage'));
create policy refunds_self_read on public.refunds for select using(user_id=auth.uid() or public.has_permission('payments.read'));
create policy refunds_admin_manage on public.refunds for all using(public.has_permission('refunds.manage')) with check(public.has_permission('refunds.manage'));
create policy manual_payments_self_read on public.manual_payment_requests for select using(user_id=auth.uid() or public.has_permission('payments.read'));
create policy manual_payments_admin_manage on public.manual_payment_requests for all using(public.has_permission('payments.manage')) with check(public.has_permission('payments.manage'));
create policy promotion_products_public_read on public.promotion_products for select using(is_active or public.has_permission('promotions.read'));
create policy promotion_products_admin_manage on public.promotion_products for all using(public.has_permission('promotions.manage')) with check(public.has_permission('promotions.manage'));
create policy promotion_activations_read on public.promotion_activations for select using(user_id=auth.uid() or public.has_permission('promotions.read') or exists(select 1 from public.properties p where p.id=property_id and p.status='published'));
create policy promotion_activations_admin_manage on public.promotion_activations for all using(public.has_permission('promotions.manage')) with check(public.has_permission('promotions.manage'));
create policy notifications_self_read on public.notifications for select using(user_id=auth.uid());
create policy notifications_self_update on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notifications_admin_manage on public.notifications for all using(public.has_permission('notifications.manage')) with check(public.has_permission('notifications.manage'));
create policy notification_preferences_self on public.notification_preferences for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notification_templates_admin on public.notification_templates for all using(public.has_permission('notifications.manage')) with check(public.has_permission('notifications.manage'));
create policy notification_deliveries_admin on public.notification_deliveries for select using(public.has_permission('notifications.manage'));
create policy analytics_daily_owner_read on public.analytics_daily for select using(owner_id=auth.uid() or public.has_permission('analytics.read'));

grant select on public.plans,public.plan_features,public.promotion_products to anon,authenticated;
grant select on public.subscriptions,public.subscription_usage,public.subscription_events,public.payment_orders,public.payments,public.payment_transactions,public.invoices,public.refunds,public.manual_payment_requests,public.promotion_activations,public.notifications,public.notification_preferences,public.analytics_daily to authenticated;
grant insert,update on public.notification_preferences to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant select,insert,update,delete on public.plans,public.plan_features,public.subscriptions,public.subscription_usage,public.payment_orders,public.invoices,public.refunds,public.manual_payment_requests,public.promotion_products,public.promotion_activations,public.notification_templates to authenticated;
grant select on public.notification_deliveries,public.payment_webhook_events to authenticated;

create trigger plans_updated before update on public.plans for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger payments_sprint5_updated before update on public.payments for each row execute function public.set_updated_at();
create trigger manual_payment_updated before update on public.manual_payment_requests for each row execute function public.set_updated_at();
create trigger promotion_products_updated before update on public.promotion_products for each row execute function public.set_updated_at();
create trigger promotion_activations_updated before update on public.promotion_activations for each row execute function public.set_updated_at();

create or replace function public.effective_plan(target_user uuid)
returns public.plans
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare result public.plans;
begin
  select p.* into result from public.subscriptions s join public.plans p on p.id=s.plan_id
  where s.user_id=target_user and s.status in ('trialing','active') and s.starts_at<=now() and s.ends_at>now() and p.is_active
  order by s.ends_at desc limit 1;
  if not found then select p.* into result from public.plans p where p.slug='free' and p.is_active order by p.created_at limit 1; end if;
  return result;
end $$;

create or replace function public.get_my_plan_context()
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare plan_record public.plans; subscription_record public.subscriptions; property_count integer; pg_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select s.* into subscription_record from public.subscriptions s where s.user_id=auth.uid() and s.status in ('trialing','active') and s.starts_at<=now() and s.ends_at>now() order by s.ends_at desc limit 1;
  plan_record:=public.effective_plan(auth.uid());
  select count(*) filter(where coalesce(p.details->>'listing_kind','property')<>'paying_guest'),count(*) filter(where p.details->>'listing_kind'='paying_guest')
  into property_count,pg_count from public.properties p where p.owner_id=auth.uid() and p.deleted_at is null;
  return jsonb_build_object('plan',to_jsonb(plan_record),'subscription',to_jsonb(subscription_record),'usage',jsonb_build_object('properties',property_count,'pg_listings',pg_count));
end $$;

create or replace function public.check_listing_plan_limit(target_kind text)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare plan_record public.plans; used integer; allowed integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_kind not in ('property','paying_guest') then raise exception 'invalid_listing_kind'; end if;
  plan_record:=public.effective_plan(auth.uid());
  if plan_record.id is null then raise exception 'plan_unavailable'; end if;
  if target_kind='paying_guest' then
    select count(*) into used from public.properties p where p.owner_id=auth.uid() and p.deleted_at is null and p.details->>'listing_kind'='paying_guest';
    allowed:=plan_record.pg_listing_limit;
  else
    select count(*) into used from public.properties p where p.owner_id=auth.uid() and p.deleted_at is null and coalesce(p.details->>'listing_kind','property')<>'paying_guest';
    allowed:=plan_record.listing_limit;
  end if;
  return jsonb_build_object('allowed',used<allowed,'used',used,'limit',allowed,'plan',plan_record.name,'code',case when used>=allowed then 'LISTING_LIMIT_REACHED' else null end);
end $$;

create or replace function public.enforce_listing_plan_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_record public.plans; used integer; kind text:=case when new.details->>'listing_kind'='paying_guest' then 'paying_guest' else 'property' end;
begin
  plan_record:=public.effective_plan(new.owner_id);
  if plan_record.id is null then raise exception 'PLAN_UNAVAILABLE'; end if;
  if kind='paying_guest' then
    select count(*) into used from public.properties p where p.owner_id=new.owner_id and p.deleted_at is null and p.details->>'listing_kind'='paying_guest';
    if used>=plan_record.pg_listing_limit then raise exception 'PG_LISTING_LIMIT_REACHED'; end if;
  else
    select count(*) into used from public.properties p where p.owner_id=new.owner_id and p.deleted_at is null and coalesce(p.details->>'listing_kind','property')<>'paying_guest';
    if used>=plan_record.listing_limit then raise exception 'LISTING_LIMIT_REACHED'; end if;
  end if;
  return new;
end $$;
drop trigger if exists properties_plan_limit_before_insert on public.properties;
create trigger properties_plan_limit_before_insert before insert on public.properties for each row execute function public.enforce_listing_plan_limit();

create or replace function public.enforce_publish_plan_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_record public.plans; used integer; kind text:=case when new.details->>'listing_kind'='paying_guest' then 'paying_guest' else 'property' end;
begin
  if new.status='published' and old.status is distinct from new.status then
    plan_record:=public.effective_plan(new.owner_id);
    if plan_record.id is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
    if kind='paying_guest' then
      select count(*) into used from public.properties p where p.owner_id=new.owner_id and p.deleted_at is null and p.details->>'listing_kind'='paying_guest' and p.status in ('approved','published');
      if used>plan_record.pg_listing_limit then raise exception 'PG_LISTING_LIMIT_REACHED'; end if;
    else
      select count(*) into used from public.properties p where p.owner_id=new.owner_id and p.deleted_at is null and coalesce(p.details->>'listing_kind','property')<>'paying_guest' and p.status in ('approved','published');
      if used>plan_record.listing_limit then raise exception 'LISTING_LIMIT_REACHED'; end if;
    end if;
    new.expires_at:=coalesce(new.expires_at,now()+make_interval(days=>plan_record.listing_duration_days));
  end if;
  return new;
end $$;
drop trigger if exists properties_publish_plan_before_update on public.properties;
create trigger properties_publish_plan_before_update before update of status on public.properties for each row execute function public.enforce_publish_plan_limit();

create or replace function public.enforce_media_plan_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid; plan_record public.plans; used integer;
begin
  select p.owner_id into owner from public.properties p where p.id=new.property_id;
  plan_record:=public.effective_plan(owner);
  select count(*) into used from public.property_media pm where pm.property_id=new.property_id and pm.media_type='image';
  if plan_record.id is null or used>=plan_record.image_limit_per_listing then raise exception 'IMAGE_LIMIT_REACHED'; end if;
  return new;
end $$;
drop trigger if exists property_media_plan_limit_before_insert on public.property_media;
create trigger property_media_plan_limit_before_insert before insert on public.property_media for each row when(new.media_type='image') execute function public.enforce_media_plan_limit();

create or replace function public.activate_subscription(target_user uuid,target_plan uuid,activation_provider text default 'manual',provider_reference text default null,activation_actor uuid default null)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_record public.plans; result uuid; actor uuid:=coalesce(activation_actor,auth.uid()); duration interval;
begin
  if actor is null then raise exception 'permission_denied'; end if;
  if auth.uid() is not null and not public.has_permission('subscriptions.manage') then raise exception 'permission_denied'; end if;
  select * into plan_record from public.plans where id=target_plan and is_active for share;
  if not found then raise exception 'plan_not_available'; end if;
  duration:=case when plan_record.billing_period='free' then make_interval(days=>plan_record.listing_duration_days) else make_interval(months=>greatest(plan_record.billing_interval_months,1)) end;
  update public.subscriptions s set status='expired' where s.user_id=target_user and s.status in ('trialing','active') and s.ends_at<=now();
  update public.subscriptions s set status='cancelled',cancelled_at=now() where s.user_id=target_user and s.status in ('trialing','active') and s.ends_at>now();
  insert into public.subscriptions(user_id,plan_id,status,starts_at,ends_at,renewal_at,provider,provider_subscription_id,activated_by)
  values(target_user,target_plan,'active',now(),now()+duration,case when plan_record.billing_period='free' then null else now()+duration end,activation_provider,provider_reference,actor)
  returning id into result;
  insert into public.subscription_events(subscription_id,event_type,to_status,actor_id,details) values(result,'activated','active',actor,jsonb_build_object('plan_id',target_plan,'provider',activation_provider));
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(actor,'subscription.activate','subscription',result::text,jsonb_build_object('user_id',target_user,'plan_id',target_plan));
  return result;
end $$;

create or replace function public.cancel_my_subscription(target_subscription uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare record public.subscriptions;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into record from public.subscriptions s where s.id=target_subscription and s.user_id=auth.uid() and s.status in ('trialing','active','past_due','paused') for update;
  if not found then raise exception 'subscription_not_cancellable'; end if;
  update public.subscriptions s set status='cancelled',cancelled_at=now(),auto_renew=false where s.id=target_subscription;
  insert into public.subscription_events(subscription_id,event_type,from_status,to_status,actor_id) values(target_subscription,'cancelled',record.status,'cancelled',auth.uid());
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'subscription.cancel','subscription',target_subscription::text,jsonb_build_object('ends_at',record.ends_at));
  return jsonb_build_object('id',target_subscription,'status','cancelled','access_ends_at',record.ends_at);
end $$;

create or replace function public.admin_update_subscription(target_subscription uuid,next_status text,change_reason text)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare record public.subscriptions;
begin
  if not public.has_permission('subscriptions.manage') then raise exception 'permission_denied'; end if;
  if next_status not in ('active','past_due','paused','cancelled','expired') then raise exception 'invalid_status'; end if;
  select * into record from public.subscriptions s where s.id=target_subscription for update;
  if not found then raise exception 'subscription_not_found'; end if;
  update public.subscriptions s set status=next_status,cancelled_at=case when next_status='cancelled' then now() else s.cancelled_at end where s.id=target_subscription;
  insert into public.subscription_events(subscription_id,event_type,from_status,to_status,actor_id,details) values(target_subscription,'admin_status_change',record.status,next_status,auth.uid(),jsonb_build_object('reason',left(change_reason,1000)));
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,old_values,new_values) values(auth.uid(),'subscription.status','subscription',target_subscription::text,jsonb_build_object('status',record.status),jsonb_build_object('status',next_status,'reason',left(change_reason,1000)));
  return jsonb_build_object('id',target_subscription,'status',next_status);
end $$;

create or replace function public.create_payment_order(target_plan uuid,order_provider text,request_key uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_record public.plans; result public.payment_orders;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if order_provider not in ('razorpay','manual','custom') then raise exception 'invalid_provider'; end if;
  select * into plan_record from public.plans where id=target_plan and is_active and price>0;
  if not found then raise exception 'plan_not_purchasable'; end if;
  insert into public.payment_orders(user_id,plan_id,amount,currency,provider,idempotency_key)
  values(auth.uid(),target_plan,plan_record.price,plan_record.currency,order_provider,request_key)
  on conflict(user_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into result;
  insert into public.payment_transactions(order_id,transaction_type,amount,currency,status)
  values(result.id,'order_created',result.amount,result.currency,'created') on conflict do nothing;
  return jsonb_build_object('id',result.id,'amount',result.amount,'currency',result.currency,'status',result.status,'plan_name',plan_record.name);
end $$;

create or replace function public.create_promotion_order(target_product uuid,target_property uuid,order_provider text,request_key uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare product_record public.promotion_products; property_record public.properties; result public.payment_orders; is_pg boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if order_provider not in ('razorpay','manual','custom') then raise exception 'invalid_provider'; end if;
  select * into product_record from public.promotion_products where id=target_product and is_active and price>0;
  if not found then raise exception 'promotion_not_purchasable'; end if;
  select * into property_record from public.properties where id=target_property and owner_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'listing_not_found'; end if;
  is_pg:=property_record.details->>'listing_kind'='paying_guest';
  if product_record.eligible_listing_type <> 'both'
     and product_record.eligible_listing_type <>
         (case when is_pg then 'pg' else 'property' end)
  then
    raise exception 'listing_not_eligible';
  end if;
  insert into public.payment_orders(user_id,promotion_product_id,amount,currency,provider,idempotency_key,metadata)
  values(auth.uid(),target_product,product_record.price,product_record.currency,order_provider,request_key,jsonb_build_object('property_id',target_property))
  on conflict(user_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into result;
  insert into public.payment_transactions(order_id,transaction_type,amount,currency,status) values(result.id,'order_created',result.amount,result.currency,'created');
  return jsonb_build_object('id',result.id,'amount',result.amount,'currency',result.currency,'status',result.status,'product_name',product_record.name);
end $$;

create or replace function public.claim_plan_promotion(target_property uuid,target_type text)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare property_record public.properties; plan_record public.plans; product_record public.promotion_products; allowance integer; used integer; result uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_type not in ('featured','verified') then raise exception 'invalid_plan_promotion'; end if;
  select * into property_record from public.properties where id=target_property and owner_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'listing_not_found'; end if;
  plan_record:=public.effective_plan(auth.uid());
  allowance:=case when target_type='featured' then plan_record.featured_listing_allowance else plan_record.verified_listing_allowance end;
  select count(*) into used from public.promotion_activations a join public.promotion_products p on p.id=a.product_id
  where a.user_id=auth.uid() and a.status in ('scheduled','active') and a.ends_at>now() and p.promotion_type=target_type and a.payment_id is null;
  if used>=allowance then raise exception 'PROMOTION_ALLOWANCE_EXHAUSTED'; end if;
  select * into product_record from public.promotion_products p where p.promotion_type=target_type and p.is_active
    and (p.eligible_listing_type='both' or p.eligible_listing_type=case when property_record.details->>'listing_kind'='paying_guest' then 'pg' else 'property' end)
    order by p.duration_days desc limit 1;
  if not found then raise exception 'promotion_product_unavailable'; end if;
  insert into public.promotion_activations(product_id,property_id,user_id,starts_at,ends_at,status,created_by)
  values(product_record.id,target_property,auth.uid(),now(),now()+make_interval(days=>product_record.duration_days),'active',auth.uid()) returning id into result;
  update public.properties p set is_featured=case when target_type='featured' then true else p.is_featured end,is_verified=case when target_type='verified' then true else p.is_verified end where p.id=target_property;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'promotion.plan_activate','promotion_activation',result::text,jsonb_build_object('property_id',target_property,'type',target_type));
  return result;
end $$;

create or replace function public.create_notification(target_user uuid,notification_event text,notification_title text,notification_body text,target_entity_type text default null,target_entity_id uuid default null,target_url text default null,event_data jsonb default '{}')
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; preference public.notification_preferences;
begin
  select * into preference from public.notification_preferences where user_id=target_user and event_type=notification_event;
  if preference.user_id is null or preference.in_app_enabled then
    insert into public.notifications(user_id,event_type,title,body,entity_type,entity_id,action_url,data)
    values(target_user,notification_event,left(notification_title,180),left(notification_body,2000),target_entity_type,target_entity_id,target_url,coalesce(event_data,'{}'))
    returning id into result;
    insert into public.notification_deliveries(notification_id,channel,status) values(result,'in_app','sent');
  end if;
  if (preference.user_id is null or preference.email_enabled) then
    insert into public.notification_deliveries(notification_id,channel,status) values(result,'email','queued');
  end if;
  return result;
exception when others then return null;
end $$;

create or replace function public.process_payment_webhook(webhook_provider text,provider_event text,webhook_event_type text,signature_digest text,payload_digest text,provider_order text,provider_payment text,paid_amount numeric,paid_currency text,payment_state text,failure_message text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare event_record uuid; order_record public.payment_orders; payment_record public.payments; subscription_result uuid; product_record public.promotion_products; property_target uuid; activation_id uuid;
begin
  insert into public.payment_webhook_events(provider,provider_event_id,event_type,signature_hash,payload_hash,status,attempts)
  values(webhook_provider,provider_event,webhook_event_type,signature_digest,payload_digest,'processing',1)
  on conflict(provider,provider_event_id) do nothing returning id into event_record;
  if event_record is null then return jsonb_build_object('result','duplicate'); end if;
  select * into order_record from public.payment_orders where provider=webhook_provider and provider_order_id=provider_order for update;
  if not found then
    update public.payment_webhook_events e set status='failed',processed_at=now(),last_error='order_not_found' where e.id=event_record;
    return jsonb_build_object('result','order_not_found');
  end if;
  if paid_amount<>order_record.amount or upper(paid_currency)<>upper(order_record.currency) then
    update public.payment_orders o set status='failed' where o.id=order_record.id;
    update public.payment_webhook_events e set status='failed',processed_at=now(),last_error='amount_or_currency_mismatch' where e.id=event_record;
    return jsonb_build_object('result','amount_mismatch');
  end if;
  if payment_state='captured' then
    insert into public.payments(user_id,order_id,plan_id,method,amount_inr,reference,legacy_status,provider,provider_order_id,provider_payment_id,status,currency,payment_method,captured_at)
    values(order_record.user_id,order_record.id,order_record.plan_id,'other',order_record.amount,provider_payment,'verified',webhook_provider,provider_order,provider_payment,'captured',order_record.currency,'online',now())
    on conflict(provider,provider_payment_id) do update set status='captured',captured_at=coalesce(public.payments.captured_at,now())
    returning * into payment_record;
    update public.payment_orders o set status='captured' where o.id=order_record.id;
    insert into public.payment_transactions(payment_id,order_id,transaction_type,amount,currency,provider_reference,status)
    values(payment_record.id,order_record.id,'captured',order_record.amount,order_record.currency,provider_payment,'captured');
    if order_record.plan_id is not null then
      subscription_result:=public.activate_subscription(order_record.user_id,order_record.plan_id,webhook_provider,provider_payment,order_record.user_id);
      update public.payments p set subscription_id=subscription_result where p.id=payment_record.id;
      insert into public.invoices(user_id,payment_id,subscription_id,subtotal,total,currency,paid_at) values(order_record.user_id,payment_record.id,subscription_result,order_record.amount,order_record.amount,order_record.currency,now()) on conflict(payment_id) do nothing;
    else
      select * into product_record from public.promotion_products where id=order_record.promotion_product_id;
      property_target:=nullif(order_record.metadata->>'property_id','')::uuid;
      insert into public.promotion_activations(product_id,property_id,user_id,payment_id,starts_at,ends_at,status,created_by)
      values(product_record.id,property_target,order_record.user_id,payment_record.id,now(),now()+make_interval(days=>product_record.duration_days),'active',order_record.user_id)
      returning id into activation_id;
      update public.properties p set
        is_featured=case when product_record.promotion_type='featured' then true else p.is_featured end,
        is_verified=case when product_record.promotion_type='verified' then true else p.is_verified end,
        is_pinned=case when product_record.promotion_type='pinned' then true else p.is_pinned end
      where p.id=property_target;
      perform public.create_notification(order_record.user_id,'promotion.activated','Promotion activated',product_record.name||' is active for your listing.','property',property_target,'/dashboard/promotions',jsonb_build_object('activation_id',activation_id,'ends_at',now()+make_interval(days=>product_record.duration_days)));
      insert into public.invoices(user_id,payment_id,subtotal,total,currency,paid_at) values(order_record.user_id,payment_record.id,order_record.amount,order_record.amount,order_record.currency,now()) on conflict(payment_id) do nothing;
    end if;
    perform public.create_notification(order_record.user_id,'payment.successful','Payment successful','Your payment has been captured.','payment',payment_record.id,'/dashboard/billing',jsonb_build_object('amount',order_record.amount));
  else
    update public.payment_orders o set status='failed' where o.id=order_record.id;
    insert into public.payments(user_id,order_id,plan_id,method,amount_inr,reference,legacy_status,provider,provider_order_id,provider_payment_id,status,currency,payment_method,failure_reason)
    values(order_record.user_id,order_record.id,order_record.plan_id,'other',order_record.amount,provider_payment,'rejected',webhook_provider,provider_order,provider_payment,'failed',order_record.currency,'online',left(failure_message,1000))
    on conflict(provider,provider_payment_id) do update set status='failed',failure_reason=excluded.failure_reason returning * into payment_record;
    perform public.create_notification(order_record.user_id,'payment.failed','Payment failed','The payment was not completed. You can retry safely.','payment',payment_record.id,'/dashboard/billing',jsonb_build_object());
  end if;
  update public.payment_webhook_events e set status='processed',processed_at=now() where e.id=event_record;
  insert into public.audit_logs(action,entity_type,entity_reference,new_values) values('payment.webhook','payment',payment_record.id::text,jsonb_build_object('provider',webhook_provider,'event_id',provider_event,'status',payment_state));
  return jsonb_build_object('result','processed','payment_id',payment_record.id,'subscription_id',subscription_result,'promotion_activation_id',activation_id);
exception when others then
  update public.payment_webhook_events e set status='failed',processed_at=now(),last_error=left(sqlerrm,500) where e.id=event_record;
  raise;
end $$;

create or replace function public.submit_manual_payment(target_plan uuid,payment_reference text,paid_on date,payment_mode_value text,submitted_amount numeric,proof_object text,request_note text)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_record public.plans; result uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into plan_record from public.plans where id=target_plan and is_active and price>0;
  if not found then raise exception 'plan_not_purchasable'; end if;
  if submitted_amount<>plan_record.price then raise exception 'amount_mismatch'; end if;
  insert into public.manual_payment_requests(user_id,plan_id,transaction_reference,payment_date,payment_mode,amount,currency,proof_path,note)
  values(auth.uid(),target_plan,left(trim(payment_reference),120),paid_on,payment_mode_value,plan_record.price,plan_record.currency,nullif(proof_object,''),left(request_note,2000))
  returning id into result;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'manual_payment.submit','manual_payment',result::text,jsonb_build_object('plan_id',target_plan,'amount',plan_record.price));
  return result;
end $$;

create or replace function public.review_manual_payment(target_request uuid,review_decision text,review_comment text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare request_record public.manual_payment_requests; payment_record public.payments; subscription_result uuid;
begin
  if not public.has_permission('payments.manage') then raise exception 'permission_denied'; end if;
  if review_decision not in ('approve','reject','request_clarification') then raise exception 'invalid_decision'; end if;
  select * into request_record from public.manual_payment_requests where id=target_request and status in ('pending','clarification_requested') for update;
  if not found then raise exception 'request_not_reviewable'; end if;
  if review_decision='approve' then
    insert into public.payments(user_id,plan_id,method,amount_inr,reference,proof_path,legacy_status,provider,status,currency,payment_method,captured_at)
    values(request_record.user_id,request_record.plan_id,case when request_record.payment_mode in ('cash','bank_transfer','qr','other') then request_record.payment_mode else 'other' end,request_record.amount,request_record.transaction_reference,request_record.proof_path,'verified','manual','captured',request_record.currency,request_record.payment_mode,now())
    returning * into payment_record;
    subscription_result:=public.activate_subscription(request_record.user_id,request_record.plan_id,'manual',request_record.transaction_reference,auth.uid());
    update public.payments p set subscription_id=subscription_result where p.id=payment_record.id;
    insert into public.invoices(user_id,payment_id,subscription_id,subtotal,total,currency,paid_at) values(request_record.user_id,payment_record.id,subscription_result,request_record.amount,request_record.amount,request_record.currency,now());
    update public.manual_payment_requests r set status='approved',reviewer_id=auth.uid(),review_note=left(review_comment,2000),reviewed_at=now(),payment_id=payment_record.id where r.id=target_request;
  elsif review_decision='reject' then
    update public.manual_payment_requests r set status='rejected',reviewer_id=auth.uid(),review_note=left(review_comment,2000),reviewed_at=now() where r.id=target_request;
  else
    update public.manual_payment_requests r set status='clarification_requested',reviewer_id=auth.uid(),review_note=left(review_comment,2000),reviewed_at=now() where r.id=target_request;
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values) values(auth.uid(),'manual_payment.review','manual_payment',target_request::text,jsonb_build_object('decision',review_decision,'payment_id',payment_record.id,'subscription_id',subscription_result));
  perform public.create_notification(request_record.user_id,'manual_payment.reviewed','Manual payment reviewed','Your manual payment was '||case when review_decision='request_clarification' then 'returned for clarification' when review_decision='approve' then 'approved' else 'rejected' end||'.','manual_payment',target_request,'/dashboard/billing',jsonb_build_object('decision',review_decision));
  return jsonb_build_object('status',case when review_decision='request_clarification' then 'clarification_requested' when review_decision='approve' then 'approved' else 'rejected' end,'payment_id',payment_record.id,'subscription_id',subscription_result);
end $$;

create or replace function public.notify_property_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare is_pg boolean:=new.details->>'listing_kind'='paying_guest'; event_name text; label text;
begin
  if tg_op='INSERT' then event_name:=case when is_pg then 'pg.draft_created' else 'property.draft_created' end;label:='Draft created';
  elsif old.status is distinct from new.status then event_name:=case when is_pg then 'pg.' else 'property.' end||new.status::text;label:=initcap(replace(new.status::text,'_',' '));
  else return new; end if;
  perform public.create_notification(new.owner_id,event_name,label,new.title||' is now '||replace(new.status::text,'_',' '),'property',new.id,case when is_pg then '/dashboard/pg' else '/dashboard/properties/'||new.id end,jsonb_build_object('reference_no',new.reference_no,'status',new.status));
  return new;
exception when others then return new;
end $$;
drop trigger if exists properties_notification_insert on public.properties;
create trigger properties_notification_insert after insert on public.properties for each row execute function public.notify_property_event();
drop trigger if exists properties_notification_status on public.properties;
create trigger properties_notification_status after update of status on public.properties for each row execute function public.notify_property_event();

create or replace function public.notify_enquiry_owner()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid; title text;
begin
  select p.owner_id,p.title into owner,title from public.properties p where p.id=new.property_id;
  if owner is not null then perform public.create_notification(owner,'enquiry.received','New enquiry','A new enquiry was received for '||title,'enquiry',new.id,'/dashboard/enquiries',jsonb_build_object('reference_no',new.reference_no)); end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists enquiry_owner_notification on public.enquiries;
create trigger enquiry_owner_notification after insert on public.enquiries for each row execute function public.notify_enquiry_owner();

create or replace function public.notify_profile_signup()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.create_notification(new.id,'signup.completed','Welcome to OngoleProperty.com','Your account is ready. Create a property or PG listing when you are ready.','profile',new.id,'/dashboard',jsonb_build_object());
  return new;
exception when others then return new;
end $$;
drop trigger if exists profile_signup_notification on public.profiles;
create trigger profile_signup_notification after insert on public.profiles for each row execute function public.notify_profile_signup();

create or replace function public.notify_subscription_activation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare plan_name text;
begin
  select p.name into plan_name from public.plans p where p.id=new.plan_id;
  perform public.create_notification(new.user_id,'subscription.activated','Subscription activated',coalesce(plan_name,'Your plan')||' is active.','subscription',new.id,'/dashboard/billing',jsonb_build_object('ends_at',new.ends_at));
  return new;
exception when others then return new;
end $$;
drop trigger if exists subscription_activation_notification on public.subscriptions;
create trigger subscription_activation_notification after insert on public.subscriptions for each row when(new.status in ('trialing','active')) execute function public.notify_subscription_activation();

create or replace function public.enqueue_expiry_notifications()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; affected integer:=0;
begin
  if auth.uid() is not null and not public.has_permission('notifications.manage') then raise exception 'permission_denied'; end if;
  for item in select s.id,s.user_id,s.ends_at,p.name from public.subscriptions s join public.plans p on p.id=s.plan_id where s.status in ('trialing','active') and s.ends_at>now() and s.ends_at<=now()+interval '7 days' loop
    if not exists(select 1 from public.notifications n where n.user_id=item.user_id and n.event_type='subscription.expiring' and n.entity_id=item.id) then
      perform public.create_notification(item.user_id,'subscription.expiring','Subscription expiring',item.name||' expires soon.','subscription',item.id,'/dashboard/billing',jsonb_build_object('ends_at',item.ends_at));affected:=affected+1;
    end if;
  end loop;
  for item in select a.id,a.user_id,a.ends_at,p.name from public.promotion_activations a join public.promotion_products p on p.id=a.product_id where a.status='active' and a.ends_at>now() and a.ends_at<=now()+interval '3 days' loop
    if not exists(select 1 from public.notifications n where n.user_id=item.user_id and n.event_type='promotion.expiring' and n.entity_id=item.id) then
      perform public.create_notification(item.user_id,'promotion.expiring','Promotion expiring',item.name||' expires soon.','promotion_activation',item.id,'/dashboard/promotions',jsonb_build_object('ends_at',item.ends_at));affected:=affected+1;
    end if;
  end loop;
  return affected;
end $$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.notifications n set read_at=now() where n.user_id=auth.uid() and n.read_at is null;
  get diagnostics affected=row_count;return affected;
end $$;

create or replace function public.aggregate_analytics(target_day date default current_date-1)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer;
begin
  if auth.uid() is not null and not public.has_permission('analytics.read') then raise exception 'permission_denied'; end if;
  insert into public.analytics_daily(day,owner_id,entity_type,entity_id,event_type,event_count)
  select target_day,p.owner_id,coalesce(a.entity_type,'platform'),a.entity_id,a.event_type,count(*)
  from public.analytics_events a left join public.properties p on a.entity_type in ('property','pg') and p.id=a.entity_id
  where a.created_at>=target_day::timestamptz and a.created_at<(target_day+1)::timestamptz
  group by p.owner_id,coalesce(a.entity_type,'platform'),a.entity_id,a.event_type
  on conflict(day,(coalesce(owner_id,'00000000-0000-0000-0000-000000000000'::uuid)),entity_type,(coalesce(entity_id,'00000000-0000-0000-0000-000000000000'::uuid)),event_type)
  do update set event_count=excluded.event_count,updated_at=now();
  get diagnostics affected=row_count;return affected;
end $$;

create or replace function public.expire_promotions()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; promotion text; affected integer:=0;
begin
  if auth.uid() is not null and not public.has_permission('promotions.manage') then raise exception 'permission_denied'; end if;
  for target,promotion in select a.id,p.promotion_type from public.promotion_activations a join public.promotion_products p on p.id=a.product_id where a.status='active' and a.ends_at<=now() for update of a loop
    update public.promotion_activations a set status='expired' where a.id=target;
    affected:=affected+1;
  end loop;
  update public.properties p set
    is_featured=exists(select 1 from public.promotion_activations a join public.promotion_products x on x.id=a.product_id where a.property_id=p.id and a.status='active' and a.ends_at>now() and x.promotion_type='featured'),
    is_verified=exists(select 1 from public.promotion_activations a join public.promotion_products x on x.id=a.product_id where a.property_id=p.id and a.status='active' and a.ends_at>now() and x.promotion_type='verified'),
    is_pinned=exists(select 1 from public.promotion_activations a join public.promotion_products x on x.id=a.product_id where a.property_id=p.id and a.status='active' and a.ends_at>now() and x.promotion_type='pinned')
  where p.id in (select a.property_id from public.promotion_activations a);
  return affected;
end $$;

revoke all on function public.effective_plan(uuid) from public;
revoke all on function public.get_my_plan_context() from public;
revoke all on function public.check_listing_plan_limit(text) from public;
revoke all on function public.enforce_listing_plan_limit() from public;
revoke all on function public.enforce_media_plan_limit() from public;
revoke all on function public.enforce_publish_plan_limit() from public;
revoke all on function public.activate_subscription(uuid,uuid,text,text,uuid) from public;
revoke all on function public.cancel_my_subscription(uuid) from public;
revoke all on function public.admin_update_subscription(uuid,text,text) from public;
revoke all on function public.create_payment_order(uuid,text,uuid) from public;
revoke all on function public.create_promotion_order(uuid,uuid,text,uuid) from public;
revoke all on function public.claim_plan_promotion(uuid,text) from public;
revoke all on function public.process_payment_webhook(text,text,text,text,text,text,text,numeric,text,text,text) from public;
revoke all on function public.submit_manual_payment(uuid,text,date,text,numeric,text,text) from public;
revoke all on function public.review_manual_payment(uuid,text,text) from public;
revoke all on function public.create_notification(uuid,text,text,text,text,uuid,text,jsonb) from public;
revoke all on function public.notify_property_event() from public;
revoke all on function public.notify_enquiry_owner() from public;
revoke all on function public.notify_profile_signup() from public;
revoke all on function public.notify_subscription_activation() from public;
revoke all on function public.enqueue_expiry_notifications() from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.aggregate_analytics(date) from public;
revoke all on function public.expire_promotions() from public;
grant execute on function public.get_my_plan_context(),public.check_listing_plan_limit(text),public.create_payment_order(uuid,text,uuid),public.create_promotion_order(uuid,uuid,text,uuid),public.claim_plan_promotion(uuid,text),public.submit_manual_payment(uuid,text,date,text,numeric,text,text),public.mark_all_notifications_read() to authenticated;
grant execute on function public.cancel_my_subscription(uuid),public.admin_update_subscription(uuid,text,text),public.activate_subscription(uuid,uuid,text,text,uuid),public.review_manual_payment(uuid,text,text),public.aggregate_analytics(date),public.expire_promotions() to authenticated;
grant execute on function public.enqueue_expiry_notifications() to authenticated,service_role;
grant execute on function public.process_payment_webhook(text,text,text,text,text,text,text,numeric,text,text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists payment_proofs_owner_insert on storage.objects;
create policy payment_proofs_owner_insert on storage.objects for insert to authenticated with check(bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists payment_proofs_owner_read on storage.objects;
create policy payment_proofs_owner_read on storage.objects for select to authenticated using(bucket_id='payment-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_permission('payments.read')));
