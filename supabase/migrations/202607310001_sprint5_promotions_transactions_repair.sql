-- Sprint 5 partial-migration repair: transactions and promotions only.
-- Forward-only and additive. Existing tables and existing business rows are not
-- dropped, recreated, updated, or deleted.

do $$
declare
  missing_dependencies text[];
begin
  select array_agg(required_relation)
    into missing_dependencies
    from unnest(array[
      'public.profiles',
      'public.properties',
      'public.plans',
      'public.subscriptions',
      'public.payments',
      'public.notifications',
      'public.analytics_daily',
      'public.audit_logs',
      'public.permissions',
      'public.roles',
      'public.role_permissions',
      'storage.buckets',
      'storage.objects'
    ]) required_relation
   where to_regclass(required_relation) is null;

  if missing_dependencies is not null then
    raise exception 'sprint5_repair_missing_dependencies: %', array_to_string(missing_dependencies, ', ');
  end if;
end
$$;

do $$
declare
  missing_dependencies text[];
begin
  select array_agg(required_function)
    into missing_dependencies
    from unnest(array[
      'public.set_updated_at()',
      'public.make_reference(text,bigint)',
      'public.has_permission(text)',
      'public.effective_plan(uuid)',
      'public.activate_subscription(uuid,uuid,text,text,uuid)',
      'public.create_notification(uuid,text,text,text,text,uuid,text,jsonb)'
    ]) required_function
   where to_regprocedure(required_function) is null;

  if missing_dependencies is not null then
    raise exception 'sprint5_repair_missing_functions: %', array_to_string(missing_dependencies, ', ');
  end if;
end
$$;

-- Canonical promotion catalogue from the original Sprint 5 migration.
create table if not exists public.promotion_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  promotion_type text not null
    check (promotion_type in ('featured','verified','pinned','homepage','search_boost','urgent')),
  duration_days integer not null check (duration_days between 1 and 365),
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'INR',
  eligible_listing_type text not null
    check (eligible_listing_type in ('property','pg','both')),
  placement text not null default 'listing',
  is_active boolean not null default true,
  display_order integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotion_products_active_idx
  on public.promotion_products(is_active, display_order);

-- Orders are included because both plan and promotion purchases depend on them.
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid references public.plans(id),
  promotion_product_id uuid references public.promotion_products(id),
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  provider text not null check (provider in ('razorpay','manual','custom')),
  provider_order_id text,
  status text not null default 'created'
    check (status in ('created','pending','authorized','captured','failed','refunded','partially_refunded','cancelled')),
  idempotency_key uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}',
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_order_id),
  unique(user_id, idempotency_key),
  check (
    (plan_id is not null)::integer
    + (promotion_product_id is not null)::integer = 1
  )
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint constraint_record
      join pg_attribute source_column
        on source_column.attrelid=constraint_record.conrelid
       and source_column.attnum=any(constraint_record.conkey)
     where constraint_record.conrelid='public.payment_orders'::regclass
       and constraint_record.confrelid='public.promotion_products'::regclass
       and constraint_record.contype='f'
       and source_column.attname='promotion_product_id'
  ) then
    alter table public.payment_orders
      add constraint payment_orders_promotion_product_fkey
      foreign key (promotion_product_id)
      references public.promotion_products(id);
  end if;
end
$$;

create index if not exists payment_orders_user_idx
  on public.payment_orders(user_id, created_at desc);

create index if not exists payment_orders_status_expiry_idx
  on public.payment_orders(status, expires_at);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  order_id uuid references public.payment_orders(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('order_created','authorized','captured','failed','refund','adjustment')),
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  provider_reference text,
  status text not null,
  raw_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (payment_id is not null or order_id is not null)
);

create index if not exists payment_transactions_payment_idx
  on public.payment_transactions(payment_id, created_at desc);

create index if not exists payment_transactions_order_idx
  on public.payment_transactions(order_id, created_at desc);

create unique index if not exists payment_transactions_order_created_idx
  on public.payment_transactions(order_id, transaction_type)
  where order_id is not null and transaction_type = 'order_created';

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_hash text not null,
  payload_hash text not null,
  status text not null default 'received'
    check (status in ('received','processing','processed','ignored','failed')),
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique(provider, provider_event_id)
);

create index if not exists payment_webhook_status_idx
  on public.payment_webhook_events(status, received_at);

create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
    default public.make_reference('INV', nextval('public.invoice_number_seq')),
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
  status text not null default 'paid'
    check (status in ('draft','issued','paid','void','refunded')),
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_issued_idx
  on public.invoices(user_id, issued_at desc);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  user_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'INR',
  provider_refund_id text,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','cancelled')),
  reason text not null,
  requested_by uuid not null references public.profiles(id),
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists refunds_payment_status_idx
  on public.refunds(payment_id, status, created_at desc);

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.plans(id),
  transaction_reference text not null,
  payment_date date not null,
  payment_mode text not null
    check (payment_mode in ('cash','bank_transfer','upi','qr','cheque','other')),
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'INR',
  proof_path text,
  note text,
  status text not null default 'pending'
    check (status in ('pending','clarification_requested','approved','rejected')),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  payment_id uuid references public.payments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, transaction_reference)
);

create index if not exists manual_payment_queue_idx
  on public.manual_payment_requests(status, created_at);

create table if not exists public.promotion_activations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.promotion_products(id),
  property_id uuid not null references public.properties(id),
  user_id uuid not null references public.profiles(id),
  payment_id uuid references public.payments(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('scheduled','active','expired','cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists promotion_active_listing_idx
  on public.promotion_activations(property_id, status, ends_at);

create index if not exists promotion_activations_user_idx
  on public.promotion_activations(user_id, status, ends_at desc);

-- Enable RLS on every repaired table, even when a table was already present.
alter table public.payments enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.invoices enable row level security;
alter table public.refunds enable row level security;
alter table public.manual_payment_requests enable row level security;
alter table public.promotion_products enable row level security;
alter table public.promotion_activations enable row level security;

-- Add only absent policies. No existing policy is replaced or weakened.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_orders' and policyname='payment_orders_self_read') then
    create policy payment_orders_self_read on public.payment_orders for select
      using (user_id=auth.uid() or public.has_permission('payments.read'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_orders' and policyname='payment_orders_self_insert') then
    create policy payment_orders_self_insert on public.payment_orders for insert
      with check (user_id=auth.uid() and status='created');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_orders' and policyname='payment_orders_admin_manage') then
    create policy payment_orders_admin_manage on public.payment_orders for all
      using (public.has_permission('payments.manage'))
      with check (public.has_permission('payments.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='payments_self_read') then
    create policy payments_self_read on public.payments for select
      using (user_id=auth.uid() or public.has_permission('payments.read'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='payments_admin_manage') then
    create policy payments_admin_manage on public.payments for all
      using (public.has_permission('payments.manage'))
      with check (public.has_permission('payments.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_transactions' and policyname='payment_transactions_self_read') then
    create policy payment_transactions_self_read on public.payment_transactions for select using (
      exists(select 1 from public.payments payment where payment.id=payment_id and (payment.user_id=auth.uid() or public.has_permission('payments.read')))
      or exists(select 1 from public.payment_orders payment_order where payment_order.id=order_id and (payment_order.user_id=auth.uid() or public.has_permission('payments.read')))
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_webhook_events' and policyname='webhook_admin_read') then
    create policy webhook_admin_read on public.payment_webhook_events for select
      using (public.has_permission('payments.read'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_self_read') then
    create policy invoices_self_read on public.invoices for select
      using (user_id=auth.uid() or public.has_permission('payments.read'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_admin_manage') then
    create policy invoices_admin_manage on public.invoices for all
      using (public.has_permission('payments.manage'))
      with check (public.has_permission('payments.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='refunds' and policyname='refunds_self_read') then
    create policy refunds_self_read on public.refunds for select
      using (user_id=auth.uid() or public.has_permission('payments.read'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='refunds' and policyname='refunds_admin_manage') then
    create policy refunds_admin_manage on public.refunds for all
      using (public.has_permission('refunds.manage'))
      with check (public.has_permission('refunds.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manual_payment_requests' and policyname='manual_payments_self_read') then
    create policy manual_payments_self_read on public.manual_payment_requests for select
      using (user_id=auth.uid() or public.has_permission('payments.read'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manual_payment_requests' and policyname='manual_payments_admin_manage') then
    create policy manual_payments_admin_manage on public.manual_payment_requests for all
      using (public.has_permission('payments.manage'))
      with check (public.has_permission('payments.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promotion_products' and policyname='promotion_products_public_read') then
    create policy promotion_products_public_read on public.promotion_products for select
      using (is_active or public.has_permission('promotions.read'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promotion_products' and policyname='promotion_products_admin_manage') then
    create policy promotion_products_admin_manage on public.promotion_products for all
      using (public.has_permission('promotions.manage'))
      with check (public.has_permission('promotions.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promotion_activations' and policyname='promotion_activations_read') then
    create policy promotion_activations_read on public.promotion_activations for select using (
      user_id=auth.uid()
      or public.has_permission('promotions.read')
      or exists(select 1 from public.properties property where property.id=property_id and property.status='published')
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='promotion_activations' and policyname='promotion_activations_admin_manage') then
    create policy promotion_activations_admin_manage on public.promotion_activations for all
      using (public.has_permission('promotions.manage'))
      with check (public.has_permission('promotions.manage'));
  end if;
end
$$;

grant select on public.promotion_products to anon, authenticated;
grant select on public.payments, public.payment_orders, public.payment_transactions,
  public.payment_webhook_events, public.invoices, public.refunds,
  public.manual_payment_requests, public.promotion_activations to authenticated;
grant insert, update, delete on public.payment_orders, public.invoices,
  public.refunds, public.manual_payment_requests, public.promotion_products,
  public.promotion_activations to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.payments'::regclass
       and tgname='payments_sprint5_updated'
       and not tgisinternal
  ) then
    create trigger payments_sprint5_updated
      before update on public.payments
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.payment_orders'::regclass
       and tgname='payment_orders_updated'
       and not tgisinternal
  ) then
    create trigger payment_orders_updated
      before update on public.payment_orders
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.manual_payment_requests'::regclass
       and tgname='manual_payment_updated'
       and not tgisinternal
  ) then
    create trigger manual_payment_updated
      before update on public.manual_payment_requests
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.promotion_products'::regclass
       and tgname='promotion_products_updated'
       and not tgisinternal
  ) then
    create trigger promotion_products_updated
      before update on public.promotion_products
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid='public.promotion_activations'::regclass
       and tgname='promotion_activations_updated'
       and not tgisinternal
  ) then
    create trigger promotion_activations_updated
      before update on public.promotion_activations
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Required configuration rows only. Existing rows are never changed.
insert into public.permissions(code,module,description) values
  ('payments.read','finance','View payments and invoices'),
  ('payments.manage','finance','Manage and reconcile payments'),
  ('refunds.manage','finance','Create and manage refunds'),
  ('promotions.read','monetization','View promotion products and activations'),
  ('promotions.manage','monetization','Manage promotion products and activations')
on conflict(code) do nothing;

insert into public.roles(code,name,description,is_system) values
  ('admin','Administrator','General platform administrator',true),
  ('pg_manager','PG Manager','Review and manage paying guest listings',true),
  ('finance_manager','Finance Manager','Manage subscriptions, payments and refunds',true),
  ('support_manager','Support Manager','Support users, subscriptions and notifications',true),
  ('read_only_admin','Read-only Administrator','Read operational and financial data',true)
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select role.id, permission.id
  from public.roles role
  cross join public.permissions permission
 where role.code='super_admin'
    or (role.code='admin' and permission.code in ('payments.read','promotions.read'))
    or (role.code='property_manager' and permission.code in ('promotions.read'))
    or (role.code='pg_manager' and permission.code in ('promotions.read'))
    or (role.code='finance_manager' and permission.code in ('payments.read','payments.manage','refunds.manage','promotions.read','promotions.manage'))
    or (role.code='support_manager' and permission.code in ('payments.read'))
    or (role.code='read_only_admin' and permission.code in ('payments.read','promotions.read'))
on conflict do nothing;

insert into public.promotion_products(
  name,slug,promotion_type,duration_days,price,
  eligible_listing_type,placement,display_order
) values
  ('Featured Property','featured-property','featured',30,999,'property','search',10),
  ('Featured PG','featured-pg','featured',30,999,'pg','search',20),
  ('Verified Property','verified-property','verified',365,1499,'property','listing',30),
  ('Verified PG','verified-pg','verified',365,1499,'pg','listing',40),
  ('Pinned Listing','pinned-listing','pinned',14,799,'both','search',50),
  ('Homepage Promotion','homepage-promotion','homepage',7,1999,'both','homepage',60),
  ('Search Boost','search-boost','search_boost',14,599,'both','search',70),
  ('Urgent Badge','urgent-badge','urgent',14,399,'both','listing',80)
on conflict(slug) do nothing;

-- Manual transaction proof storage is part of the original Sprint 5 payment
-- workflow. Only the absent bucket/policies are added; existing configuration
-- and objects are left untouched.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'payment-proofs','payment-proofs',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do nothing;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname='storage'
       and tablename='objects'
       and policyname='payment_proofs_owner_insert'
  ) then
    create policy payment_proofs_owner_insert
      on storage.objects
      for insert
      to authenticated
      with check(
        bucket_id='payment-proofs'
        and (storage.foldername(name))[1]=auth.uid()::text
      );
  end if;
  if not exists (
    select 1
      from pg_policies
     where schemaname='storage'
       and tablename='objects'
       and policyname='payment_proofs_owner_read'
  ) then
    create policy payment_proofs_owner_read
      on storage.objects
      for select
      to authenticated
      using(
        bucket_id='payment-proofs'
        and (
          (storage.foldername(name))[1]=auth.uid()::text
          or public.has_permission('payments.read')
        )
      );
  end if;
end
$$;

create or replace function public.create_payment_order(
  target_plan uuid,
  order_provider text,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  plan_record public.plans;
  result public.payment_orders;
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
  values(result.id,'order_created',result.amount,result.currency,'created')
  on conflict do nothing;
  return jsonb_build_object('id',result.id,'amount',result.amount,'currency',result.currency,'status',result.status,'plan_name',plan_record.name);
end
$$;

create or replace function public.create_promotion_order(
  target_product uuid,
  target_property uuid,
  order_provider text,
  request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  product_record public.promotion_products;
  property_record public.properties;
  result public.payment_orders;
  is_pg boolean;
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
  on conflict(user_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into result;
  insert into public.payment_transactions(order_id,transaction_type,amount,currency,status)
  values(result.id,'order_created',result.amount,result.currency,'created')
  on conflict do nothing;
  return jsonb_build_object('id',result.id,'amount',result.amount,'currency',result.currency,'status',result.status,'product_name',product_record.name);
end
$$;

create or replace function public.claim_plan_promotion(
  target_property uuid,
  target_type text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  property_record public.properties;
  plan_record public.plans;
  product_record public.promotion_products;
  allowance integer;
  used integer;
  result uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_type not in ('featured','verified') then raise exception 'invalid_plan_promotion'; end if;
  select * into property_record from public.properties where id=target_property and owner_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'listing_not_found'; end if;
  plan_record:=public.effective_plan(auth.uid());
  allowance:=case when target_type='featured' then plan_record.featured_listing_allowance else plan_record.verified_listing_allowance end;
  select count(*) into used from public.promotion_activations activation
  join public.promotion_products product on product.id=activation.product_id
  where activation.user_id=auth.uid()
    and activation.status in ('scheduled','active')
    and activation.ends_at>now()
    and product.promotion_type=target_type
    and activation.payment_id is null;
  if used>=allowance then raise exception 'PROMOTION_ALLOWANCE_EXHAUSTED'; end if;
  select * into product_record from public.promotion_products product
  where product.promotion_type=target_type
    and product.is_active
    and (
      product.eligible_listing_type='both'
      or product.eligible_listing_type =
        (case when property_record.details->>'listing_kind'='paying_guest' then 'pg' else 'property' end)
    )
  order by product.duration_days desc
  limit 1;
  if not found then raise exception 'promotion_product_unavailable'; end if;
  insert into public.promotion_activations(product_id,property_id,user_id,starts_at,ends_at,status,created_by)
  values(product_record.id,target_property,auth.uid(),now(),now()+make_interval(days=>product_record.duration_days),'active',auth.uid())
  returning id into result;
  update public.properties property
  set is_featured=case when target_type='featured' then true else property.is_featured end,
      is_verified=case when target_type='verified' then true else property.is_verified end
  where property.id=target_property;
  insert into public.audit_logs(actor_id,action,entity_type,entity_reference,new_values)
  values(auth.uid(),'promotion.plan_activate','promotion_activation',result::text,jsonb_build_object('property_id',target_property,'type',target_type));
  return result;
end
$$;

create or replace function public.enqueue_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  item record;
  affected integer:=0;
begin
  if auth.uid() is not null and not public.has_permission('notifications.manage') then raise exception 'permission_denied'; end if;
  for item in
    select subscription.id,subscription.user_id,subscription.ends_at,plan.name
    from public.subscriptions subscription
    join public.plans plan on plan.id=subscription.plan_id
    where subscription.status in ('trialing','active')
      and subscription.ends_at>now()
      and subscription.ends_at<=now()+interval '7 days'
  loop
    if not exists(
      select 1 from public.notifications notification
      where notification.user_id=item.user_id
        and notification.event_type='subscription.expiring'
        and notification.entity_id=item.id
    ) then
      perform public.create_notification(item.user_id,'subscription.expiring','Subscription expiring',item.name||' expires soon.','subscription',item.id,'/dashboard/billing',jsonb_build_object('ends_at',item.ends_at));
      affected:=affected+1;
    end if;
  end loop;
  for item in
    select activation.id,activation.user_id,activation.ends_at,product.name
    from public.promotion_activations activation
    join public.promotion_products product on product.id=activation.product_id
    where activation.status='active'
      and activation.ends_at>now()
      and activation.ends_at<=now()+interval '3 days'
  loop
    if not exists(
      select 1 from public.notifications notification
      where notification.user_id=item.user_id
        and notification.event_type='promotion.expiring'
        and notification.entity_id=item.id
    ) then
      perform public.create_notification(item.user_id,'promotion.expiring','Promotion expiring',item.name||' expires soon.','promotion_activation',item.id,'/dashboard/promotions',jsonb_build_object('ends_at',item.ends_at));
      affected:=affected+1;
    end if;
  end loop;
  return affected;
end
$$;

create or replace function public.process_payment_webhook(
  webhook_provider text,
  provider_event text,
  webhook_event_type text,
  signature_digest text,
  payload_digest text,
  provider_order text,
  provider_payment text,
  paid_amount numeric,
  paid_currency text,
  payment_state text,
  failure_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  event_record uuid;
  order_record public.payment_orders;
  payment_record public.payments;
  subscription_result uuid;
  product_record public.promotion_products;
  property_target uuid;
  activation_id uuid;
begin
  insert into public.payment_webhook_events(
    provider,provider_event_id,event_type,signature_hash,payload_hash,status,attempts
  )
  values(
    webhook_provider,provider_event,webhook_event_type,signature_digest,payload_digest,'processing',1
  )
  on conflict(provider,provider_event_id) do nothing
  returning id into event_record;

  if event_record is null then
    return jsonb_build_object('result','duplicate');
  end if;

  select *
    into order_record
    from public.payment_orders
   where provider=webhook_provider
     and provider_order_id=provider_order
   for update;

  if not found then
    update public.payment_webhook_events event
       set status='failed',processed_at=now(),last_error='order_not_found'
     where event.id=event_record;
    return jsonb_build_object('result','order_not_found');
  end if;

  if paid_amount<>order_record.amount
     or upper(paid_currency)<>upper(order_record.currency)
  then
    update public.payment_orders payment_order
       set status='failed'
     where payment_order.id=order_record.id;
    update public.payment_webhook_events event
       set status='failed',processed_at=now(),last_error='amount_or_currency_mismatch'
     where event.id=event_record;
    return jsonb_build_object('result','amount_mismatch');
  end if;

  if payment_state='captured' then
    insert into public.payments(
      user_id,order_id,plan_id,method,amount_inr,reference,legacy_status,
      provider,provider_order_id,provider_payment_id,status,currency,
      payment_method,captured_at
    )
    values(
      order_record.user_id,order_record.id,order_record.plan_id,'other',
      order_record.amount,provider_payment,'verified',webhook_provider,
      provider_order,provider_payment,'captured',order_record.currency,
      'online',now()
    )
    on conflict(provider,provider_payment_id) do update
      set status='captured',
          captured_at=coalesce(public.payments.captured_at,now())
    returning * into payment_record;

    update public.payment_orders payment_order
       set status='captured'
     where payment_order.id=order_record.id;

    insert into public.payment_transactions(
      payment_id,order_id,transaction_type,amount,currency,provider_reference,status
    )
    values(
      payment_record.id,order_record.id,'captured',order_record.amount,
      order_record.currency,provider_payment,'captured'
    );

    if order_record.plan_id is not null then
      subscription_result:=public.activate_subscription(
        order_record.user_id,order_record.plan_id,webhook_provider,
        provider_payment,order_record.user_id
      );
      update public.payments payment
         set subscription_id=subscription_result
       where payment.id=payment_record.id;
      insert into public.invoices(
        user_id,payment_id,subscription_id,subtotal,total,currency,paid_at
      )
      values(
        order_record.user_id,payment_record.id,subscription_result,
        order_record.amount,order_record.amount,order_record.currency,now()
      )
      on conflict(payment_id) do nothing;
    else
      select *
        into product_record
        from public.promotion_products
       where id=order_record.promotion_product_id;
      property_target:=nullif(order_record.metadata->>'property_id','')::uuid;
      insert into public.promotion_activations(
        product_id,property_id,user_id,payment_id,starts_at,ends_at,status,created_by
      )
      values(
        product_record.id,property_target,order_record.user_id,payment_record.id,
        now(),now()+make_interval(days=>product_record.duration_days),'active',
        order_record.user_id
      )
      returning id into activation_id;
      update public.properties property
         set is_featured=case when product_record.promotion_type='featured' then true else property.is_featured end,
             is_verified=case when product_record.promotion_type='verified' then true else property.is_verified end,
             is_pinned=case when product_record.promotion_type='pinned' then true else property.is_pinned end
       where property.id=property_target;
      perform public.create_notification(
        order_record.user_id,'promotion.activated','Promotion activated',
        product_record.name||' is active for your listing.','property',
        property_target,'/dashboard/promotions',
        jsonb_build_object(
          'activation_id',activation_id,
          'ends_at',now()+make_interval(days=>product_record.duration_days)
        )
      );
      insert into public.invoices(
        user_id,payment_id,subtotal,total,currency,paid_at
      )
      values(
        order_record.user_id,payment_record.id,order_record.amount,
        order_record.amount,order_record.currency,now()
      )
      on conflict(payment_id) do nothing;
    end if;

    perform public.create_notification(
      order_record.user_id,'payment.successful','Payment successful',
      'Your payment has been captured.','payment',payment_record.id,
      '/dashboard/billing',jsonb_build_object('amount',order_record.amount)
    );
  else
    update public.payment_orders payment_order
       set status='failed'
     where payment_order.id=order_record.id;
    insert into public.payments(
      user_id,order_id,plan_id,method,amount_inr,reference,legacy_status,
      provider,provider_order_id,provider_payment_id,status,currency,
      payment_method,failure_reason
    )
    values(
      order_record.user_id,order_record.id,order_record.plan_id,'other',
      order_record.amount,provider_payment,'rejected',webhook_provider,
      provider_order,provider_payment,'failed',order_record.currency,
      'online',left(failure_message,1000)
    )
    on conflict(provider,provider_payment_id) do update
      set status='failed',failure_reason=excluded.failure_reason
    returning * into payment_record;
    perform public.create_notification(
      order_record.user_id,'payment.failed','Payment failed',
      'The payment was not completed. You can retry safely.','payment',
      payment_record.id,'/dashboard/billing',jsonb_build_object()
    );
  end if;

  update public.payment_webhook_events event
     set status='processed',processed_at=now()
   where event.id=event_record;
  insert into public.audit_logs(action,entity_type,entity_reference,new_values)
  values(
    'payment.webhook','payment',payment_record.id::text,
    jsonb_build_object(
      'provider',webhook_provider,'event_id',provider_event,'status',payment_state
    )
  );
  return jsonb_build_object(
    'result','processed',
    'payment_id',payment_record.id,
    'subscription_id',subscription_result,
    'promotion_activation_id',activation_id
  );
exception when others then
  update public.payment_webhook_events event
     set status='failed',processed_at=now(),last_error=left(sqlerrm,500)
   where event.id=event_record;
  raise;
end
$$;

create or replace function public.submit_manual_payment(
  target_plan uuid,
  payment_reference text,
  paid_on date,
  payment_mode_value text,
  submitted_amount numeric,
  proof_object text,
  request_note text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  plan_record public.plans;
  result uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into plan_record
    from public.plans
   where id=target_plan and is_active and price>0;
  if not found then raise exception 'plan_not_purchasable'; end if;
  if submitted_amount<>plan_record.price then raise exception 'amount_mismatch'; end if;
  insert into public.manual_payment_requests(
    user_id,plan_id,transaction_reference,payment_date,payment_mode,
    amount,currency,proof_path,note
  )
  values(
    auth.uid(),target_plan,left(trim(payment_reference),120),paid_on,
    payment_mode_value,plan_record.price,plan_record.currency,
    nullif(proof_object,''),left(request_note,2000)
  )
  returning id into result;
  insert into public.audit_logs(
    actor_id,action,entity_type,entity_reference,new_values
  )
  values(
    auth.uid(),'manual_payment.submit','manual_payment',result::text,
    jsonb_build_object('plan_id',target_plan,'amount',plan_record.price)
  );
  return result;
end
$$;

create or replace function public.review_manual_payment(
  target_request uuid,
  review_decision text,
  review_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  request_record public.manual_payment_requests;
  payment_record public.payments;
  subscription_result uuid;
begin
  if not public.has_permission('payments.manage') then raise exception 'permission_denied'; end if;
  if review_decision not in ('approve','reject','request_clarification') then
    raise exception 'invalid_decision';
  end if;
  select *
    into request_record
    from public.manual_payment_requests
   where id=target_request
     and status in ('pending','clarification_requested')
   for update;
  if not found then raise exception 'request_not_reviewable'; end if;

  if review_decision='approve' then
    insert into public.payments(
      user_id,plan_id,method,amount_inr,reference,proof_path,legacy_status,
      provider,status,currency,payment_method,captured_at
    )
    values(
      request_record.user_id,request_record.plan_id,
      case when request_record.payment_mode in ('cash','bank_transfer','qr','other')
        then request_record.payment_mode else 'other' end,
      request_record.amount,request_record.transaction_reference,
      request_record.proof_path,'verified','manual','captured',
      request_record.currency,request_record.payment_mode,now()
    )
    returning * into payment_record;
    subscription_result:=public.activate_subscription(
      request_record.user_id,request_record.plan_id,'manual',
      request_record.transaction_reference,auth.uid()
    );
    update public.payments payment
       set subscription_id=subscription_result
     where payment.id=payment_record.id;
    insert into public.invoices(
      user_id,payment_id,subscription_id,subtotal,total,currency,paid_at
    )
    values(
      request_record.user_id,payment_record.id,subscription_result,
      request_record.amount,request_record.amount,request_record.currency,now()
    );
    update public.manual_payment_requests request
       set status='approved',reviewer_id=auth.uid(),
           review_note=left(review_comment,2000),reviewed_at=now(),
           payment_id=payment_record.id
     where request.id=target_request;
  elsif review_decision='reject' then
    update public.manual_payment_requests request
       set status='rejected',reviewer_id=auth.uid(),
           review_note=left(review_comment,2000),reviewed_at=now()
     where request.id=target_request;
  else
    update public.manual_payment_requests request
       set status='clarification_requested',reviewer_id=auth.uid(),
           review_note=left(review_comment,2000),reviewed_at=now()
     where request.id=target_request;
  end if;

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_reference,new_values
  )
  values(
    auth.uid(),'manual_payment.review','manual_payment',target_request::text,
    jsonb_build_object(
      'decision',review_decision,'payment_id',payment_record.id,
      'subscription_id',subscription_result
    )
  );
  perform public.create_notification(
    request_record.user_id,'manual_payment.reviewed','Manual payment reviewed',
    'Your manual payment was '||
      case
        when review_decision='request_clarification' then 'returned for clarification'
        when review_decision='approve' then 'approved'
        else 'rejected'
      end||'.',
    'manual_payment',target_request,'/dashboard/billing',
    jsonb_build_object('decision',review_decision)
  );
  return jsonb_build_object(
    'status',
    case
      when review_decision='request_clarification' then 'clarification_requested'
      when review_decision='approve' then 'approved'
      else 'rejected'
    end,
    'payment_id',payment_record.id,
    'subscription_id',subscription_result
  );
end
$$;

-- Replace the broken production body that references non-canonical
-- public.promotions. This is the original Sprint 5 activation model.
create or replace function public.expire_promotions()
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target uuid;
  affected integer:=0;
begin
  if auth.uid() is not null and not public.has_permission('promotions.manage') then raise exception 'permission_denied'; end if;
  for target in
    select activation.id
    from public.promotion_activations activation
    where activation.status='active'
      and activation.ends_at<=now()
    for update of activation
  loop
    update public.promotion_activations activation
    set status='expired'
    where activation.id=target;
    affected:=affected+1;
  end loop;
  update public.properties property
  set is_featured=exists(
        select 1 from public.promotion_activations activation
        join public.promotion_products product on product.id=activation.product_id
        where activation.property_id=property.id
          and activation.status='active'
          and activation.ends_at>now()
          and product.promotion_type='featured'
      ),
      is_verified=exists(
        select 1 from public.promotion_activations activation
        join public.promotion_products product on product.id=activation.product_id
        where activation.property_id=property.id
          and activation.status='active'
          and activation.ends_at>now()
          and product.promotion_type='verified'
      ),
      is_pinned=exists(
        select 1 from public.promotion_activations activation
        join public.promotion_products product on product.id=activation.product_id
        where activation.property_id=property.id
          and activation.status='active'
          and activation.ends_at>now()
          and product.promotion_type='pinned'
      )
  where property.id in (
    select activation.property_id
    from public.promotion_activations activation
  );
  return affected;
end
$$;

revoke all on function public.create_payment_order(uuid,text,uuid) from public, anon;
revoke all on function public.create_promotion_order(uuid,uuid,text,uuid) from public, anon;
revoke all on function public.claim_plan_promotion(uuid,text) from public, anon;
revoke all on function public.process_payment_webhook(text,text,text,text,text,text,text,numeric,text,text,text) from public, anon;
revoke all on function public.submit_manual_payment(uuid,text,date,text,numeric,text,text) from public, anon;
revoke all on function public.review_manual_payment(uuid,text,text) from public, anon;
revoke all on function public.enqueue_expiry_notifications() from public, anon;
revoke all on function public.expire_promotions() from public, anon;

grant execute on function public.create_payment_order(uuid,text,uuid) to authenticated;
grant execute on function public.create_promotion_order(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.claim_plan_promotion(uuid,text) to authenticated;
grant execute on function public.submit_manual_payment(uuid,text,date,text,numeric,text,text) to authenticated;
grant execute on function public.review_manual_payment(uuid,text,text) to authenticated;
grant execute on function public.process_payment_webhook(text,text,text,text,text,text,text,numeric,text,text,text) to service_role;
grant execute on function public.enqueue_expiry_notifications() to authenticated, service_role;
grant execute on function public.expire_promotions() to authenticated, service_role;
