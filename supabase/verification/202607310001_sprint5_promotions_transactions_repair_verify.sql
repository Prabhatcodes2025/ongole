-- Read-only verification for 202607310001_sprint5_promotions_transactions_repair.sql.
-- Run in the Supabase SQL editor after applying the repair. Every "present" or
-- "valid" value returned by these queries must be true.

-- 1. Canonical tables. Sprint 5 does not define public.promotions or
-- public.transactions; the canonical names are promotion_products,
-- promotion_activations, and payment_transactions.
with expected(table_name) as (
  values
    ('promotion_products'),
    ('promotion_activations'),
    ('payment_orders'),
    ('payment_transactions'),
    ('payment_webhook_events'),
    ('invoices'),
    ('refunds'),
    ('manual_payment_requests')
)
select
  table_name,
  to_regclass(format('public.%I',table_name)) is not null as present
from expected
order by table_name;

-- 2. Foreign keys.
with expected(table_name,column_name,foreign_table,foreign_column) as (
  values
    ('payment_orders','user_id','profiles','id'),
    ('payment_orders','plan_id','plans','id'),
    ('payment_orders','promotion_product_id','promotion_products','id'),
    ('payment_transactions','payment_id','payments','id'),
    ('payment_transactions','order_id','payment_orders','id'),
    ('invoices','user_id','profiles','id'),
    ('invoices','payment_id','payments','id'),
    ('invoices','subscription_id','subscriptions','id'),
    ('refunds','payment_id','payments','id'),
    ('refunds','user_id','profiles','id'),
    ('manual_payment_requests','user_id','profiles','id'),
    ('manual_payment_requests','plan_id','plans','id'),
    ('promotion_activations','product_id','promotion_products','id'),
    ('promotion_activations','property_id','properties','id'),
    ('promotion_activations','user_id','profiles','id')
)
select
  expected.*,
  exists (
    select 1
      from information_schema.table_constraints constraint_record
      join information_schema.key_column_usage source_column
        on source_column.constraint_schema=constraint_record.constraint_schema
       and source_column.constraint_name=constraint_record.constraint_name
      join information_schema.constraint_column_usage target_column
        on target_column.constraint_schema=constraint_record.constraint_schema
       and target_column.constraint_name=constraint_record.constraint_name
     where constraint_record.constraint_type='FOREIGN KEY'
       and constraint_record.table_schema='public'
       and constraint_record.table_name=expected.table_name
       and source_column.column_name=expected.column_name
       and target_column.table_schema='public'
       and target_column.table_name=expected.foreign_table
       and target_column.column_name=expected.foreign_column
  ) as present
from expected
order by table_name,column_name;

-- 3. Required indexes (including webhook/order idempotency).
with expected(index_name) as (
  values
    ('promotion_products_active_idx'),
    ('promotion_active_listing_idx'),
    ('promotion_activations_user_idx'),
    ('payment_orders_user_idx'),
    ('payment_orders_status_expiry_idx'),
    ('payment_transactions_payment_idx'),
    ('payment_transactions_order_idx'),
    ('payment_transactions_order_created_idx'),
    ('payment_webhook_status_idx'),
    ('invoices_user_issued_idx'),
    ('refunds_payment_status_idx'),
    ('manual_payment_queue_idx')
)
select
  index_name,
  exists (
    select 1
      from pg_indexes
     where schemaname='public'
       and pg_indexes.indexname=expected.index_name
  ) as present
from expected
order by index_name;

-- 4. RLS must be enabled on all repaired tables.
with expected(table_name) as (
  values
    ('promotion_products'),
    ('promotion_activations'),
    ('payment_orders'),
    ('payment_transactions'),
    ('payment_webhook_events'),
    ('invoices'),
    ('refunds'),
    ('manual_payment_requests')
)
select
  table_name,
  coalesce((
    select relation.relrowsecurity
      from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
     where namespace.nspname='public'
       and relation.relname=expected.table_name
  ),false) as rls_enabled
from expected
order by table_name;

-- 5. Required policies.
with expected(table_name,policy_name) as (
  values
    ('payment_orders','payment_orders_self_read'),
    ('payment_orders','payment_orders_self_insert'),
    ('payment_orders','payment_orders_admin_manage'),
    ('payments','payments_self_read'),
    ('payments','payments_admin_manage'),
    ('payment_transactions','payment_transactions_self_read'),
    ('payment_webhook_events','webhook_admin_read'),
    ('invoices','invoices_self_read'),
    ('invoices','invoices_admin_manage'),
    ('refunds','refunds_self_read'),
    ('refunds','refunds_admin_manage'),
    ('manual_payment_requests','manual_payments_self_read'),
    ('manual_payment_requests','manual_payments_admin_manage'),
    ('promotion_products','promotion_products_public_read'),
    ('promotion_products','promotion_products_admin_manage'),
    ('promotion_activations','promotion_activations_read'),
    ('promotion_activations','promotion_activations_admin_manage')
)
select
  table_name,
  policy_name,
  exists (
    select 1
      from pg_policies
     where schemaname='public'
       and pg_policies.tablename=expected.table_name
       and pg_policies.policyname=expected.policy_name
  ) as present
from expected
order by table_name,policy_name;

-- 6. Updated-at triggers.
with expected(table_name,trigger_name) as (
  values
    ('payments','payments_sprint5_updated'),
    ('payment_orders','payment_orders_updated'),
    ('manual_payment_requests','manual_payment_updated'),
    ('promotion_products','promotion_products_updated'),
    ('promotion_activations','promotion_activations_updated')
)
select
  table_name,
  trigger_name,
  exists (
    select 1
      from pg_trigger trigger_record
      join pg_class relation on relation.oid=trigger_record.tgrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
     where namespace.nspname='public'
       and relation.relname=expected.table_name
       and trigger_record.tgname=expected.trigger_name
       and not trigger_record.tgisinternal
  ) as present
from expected
order by table_name;

-- 7. Functions and exact signatures.
with expected(signature) as (
  values
    ('public.create_payment_order(uuid,text,uuid)'),
    ('public.create_promotion_order(uuid,uuid,text,uuid)'),
    ('public.claim_plan_promotion(uuid,text)'),
    ('public.process_payment_webhook(text,text,text,text,text,text,text,numeric,text,text,text)'),
    ('public.submit_manual_payment(uuid,text,date,text,numeric,text,text)'),
    ('public.review_manual_payment(uuid,text,text)'),
    ('public.enqueue_expiry_notifications()'),
    ('public.expire_promotions()')
)
select
  signature,
  to_regprocedure(signature) is not null as present
from expected
order by signature;

-- 8. Confirm the repaired expiry function uses the canonical activation model
-- and no longer references the missing public.promotions table.
with body as (
  select pg_get_functiondef(
    'public.expire_promotions()'::regprocedure
  ) as definition
)
select
  definition ilike '%public.promotion_activations%' as uses_activations,
  definition ilike '%public.promotion_products%' as uses_products,
  definition not ilike '%public.promotions%' as no_legacy_promotions_reference,
  definition ilike '%where activation.id=target%' as row_scoped_activation_update
from body;

-- 9. Required permissions.
with expected(permission_code) as (
  values
    ('payments.read'),
    ('payments.manage'),
    ('refunds.manage'),
    ('promotions.read'),
    ('promotions.manage')
)
select
  permission_code,
  exists (
    select 1
      from public.permissions permission
     where permission.code=expected.permission_code
  ) as present
from expected
order by permission_code;

-- 10. Promotion catalogue seed. Existing rows are not overwritten by repair.
with expected(slug) as (
  values
    ('featured-property'),
    ('featured-pg'),
    ('verified-property'),
    ('verified-pg'),
    ('pinned-listing'),
    ('homepage-promotion'),
    ('search-boost'),
    ('urgent-badge')
)
select
  slug,
  exists (
    select 1
      from public.promotion_products product
     where product.slug=expected.slug
  ) as present
from expected
order by slug;

-- 11. Manual payment proof bucket and owner/admin policies.
select
  exists (
    select 1 from storage.buckets where id='payment-proofs'
  ) as payment_proofs_bucket,
  exists (
    select 1 from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='payment_proofs_owner_insert'
  ) as owner_insert_policy,
  exists (
    select 1 from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='payment_proofs_owner_read'
  ) as owner_read_policy;

-- 12. Table grants. RLS remains authoritative for authenticated access.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in (
    'promotion_products','promotion_activations','payment_orders',
    'payment_transactions','payment_webhook_events','invoices','refunds',
    'manual_payment_requests'
  )
  and grantee in ('anon','authenticated','service_role')
order by table_name,grantee,privilege_type;

-- 13. A compact failure-only summary. A successful repair returns zero rows.
with expected_tables(table_name) as (
  values
    ('promotion_products'),('promotion_activations'),('payment_orders'),
    ('payment_transactions'),('payment_webhook_events'),('invoices'),
    ('refunds'),('manual_payment_requests')
),
expected_functions(signature) as (
  values
    ('public.create_payment_order(uuid,text,uuid)'),
    ('public.create_promotion_order(uuid,uuid,text,uuid)'),
    ('public.claim_plan_promotion(uuid,text)'),
    ('public.process_payment_webhook(text,text,text,text,text,text,text,numeric,text,text,text)'),
    ('public.submit_manual_payment(uuid,text,date,text,numeric,text,text)'),
    ('public.review_manual_payment(uuid,text,text)'),
    ('public.enqueue_expiry_notifications()'),
    ('public.expire_promotions()')
)
select 'missing_table' as issue,table_name as object_name
from expected_tables
where to_regclass(format('public.%I',table_name)) is null
union all
select 'missing_function',signature
from expected_functions
where to_regprocedure(signature) is null;
