import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const modulePath=process.env.PGLITE_MODULE;
if(!modulePath)throw new Error("PGLITE_MODULE must point to the installed @electric-sql/pglite module.");
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();

const bootstrap=`
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;

create type public.payment_status as enum('pending','verified','rejected','refunded');
create table public.profiles(id uuid primary key,full_name text,email text,account_type text,status text default 'active',created_at timestamptz default now());
create table public.permissions(id uuid primary key default gen_random_uuid(),code text unique not null,module text not null,description text);
create table public.roles(id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,description text,is_system boolean default false);
create table public.role_permissions(role_id uuid references public.roles(id),permission_id uuid references public.permissions(id),primary key(role_id,permission_id));
insert into public.roles(code,name,is_system) values('super_admin','Super Administrator',true),('property_manager','Property Manager',true);
insert into public.permissions(code,module) values
('properties.read','properties'),('properties.manage','properties'),('pg.read','pg'),('pg.manage','pg'),
('enquiries.read','enquiries'),('enquiries.manage','enquiries'),('users.read','users'),
('analytics.read','analytics'),('audit.read','audit');
create or replace function public.has_permission(required_permission text) returns boolean language sql stable as $$ select false $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at:=now();return new;end $$;
create or replace function public.make_reference(prefix text,sequence_value bigint) returns text language sql immutable as $$ select prefix||'-'||sequence_value::text $$;

create table public.properties(
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
  reference_no text not null default '',title text not null default '',status text not null default 'draft',
  details jsonb not null default '{}',deleted_at timestamptz,published_at timestamptz,updated_at timestamptz default now(),
  is_featured boolean default false,is_verified boolean default false,is_pinned boolean default false
);
create table public.property_media(id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),media_type text not null);
create table public.enquiries(id uuid primary key default gen_random_uuid(),property_id uuid references public.properties(id),reference_no text not null default '',created_at timestamptz default now());
create table public.analytics_events(id uuid primary key default gen_random_uuid(),event_type text not null,entity_type text,entity_id uuid,created_at timestamptz default now());
create table public.audit_logs(
  id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id),action text not null,
  entity_type text not null,entity_reference text,old_values jsonb,new_values jsonb,created_at timestamptz default now()
);
create table public.payments(
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
  method text not null,amount_inr numeric(12,2) not null,reference text,proof_path text,
  status public.payment_status not null default 'pending',verified_by uuid references public.profiles(id),
  verified_at timestamptz,created_at timestamptz not null default now()
);
`;

try{
  await db.exec(bootstrap);
  const migration=await readFile(new URL("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql",import.meta.url),"utf8");
  await db.exec(`begin;\n${migration}\ncommit;`);
  const functionCheck=await db.query(`
    select pg_get_function_result(p.oid) as result_type, l.lanname as language
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.proname='create_promotion_order'
  `);
  const tableCheck=await db.query(`
    select count(*)::int as count from information_schema.tables
    where table_schema='public' and table_name in (
      'plans','plan_features','subscriptions','subscription_usage','subscription_events','payment_orders',
      'payment_transactions','payment_webhook_events','invoices','refunds','manual_payment_requests',
      'promotion_products','promotion_activations','notifications','notification_preferences',
      'notification_templates','notification_deliveries','analytics_daily'
    )
  `);
  const fn=functionCheck.rows[0],tableCount=tableCheck.rows[0]?.count;
  if(fn?.result_type!=="jsonb"||fn?.language!=="plpgsql")throw new Error("create_promotion_order signature validation failed.");
  if(tableCount!==18)throw new Error(`Expected 18 Sprint 5 tables, found ${tableCount}.`);
  console.log(JSON.stringify({migration:"executed",transaction:"committed",tables:tableCount,create_promotion_order:fn}));
}finally{
  await db.close();
}
