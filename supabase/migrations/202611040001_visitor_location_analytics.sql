-- Paginated Country -> Region/State -> City reporting over existing, consented analytics metadata.
-- This migration does not backfill or invent historical locations and stores no raw IP addresses.
begin;

create or replace function public.get_visitor_location_analytics(
  date_from date,
  date_to date,
  country_filter text default null,
  region_filter text default null,
  city_filter text default null,
  sort_by text default 'visitors',
  sort_direction text default 'desc',
  page_number integer default 1,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.has_permission('analytics.read') then
    raise exception 'permission_denied';
  end if;
  if date_from is null or date_to is null or date_from > date_to or date_to - date_from > 366 then
    raise exception 'invalid_date_range';
  end if;
if sort_by not in ('visitors','page_views','country','region','city')
   or sort_direction not in ('asc','desc') then    raise exception 'invalid_sort';
  end if;
  if page_number < 1 or page_size < 1 or page_size > 100
    or length(coalesce(country_filter,'')) > 100
    or length(coalesce(region_filter,'')) > 100
    or length(coalesce(city_filter,'')) > 100 then
    raise exception 'invalid_pagination_or_filter';
  end if;

  with visits as materialized (
    select
      coalesce(nullif(metadata->>'country',''),'Unknown') as country,
      coalesce(nullif(metadata->>'region',''),'Unknown') as region,
      coalesce(nullif(metadata->>'city',''),'Unknown') as city,
      session_hash
    from public.analytics_events
    where event_type = 'page_view'
      and created_at >= date_from::timestamptz
      and created_at < (date_to + 1)::timestamptz
  ), countries as (
    select distinct country as value from visits
  ), regions as (
    select distinct region as value from visits
    where nullif(country_filter,'') is null or country = country_filter
  ), cities as (
    select distinct city as value from visits
    where (nullif(country_filter,'') is null or country = country_filter)
      and (nullif(region_filter,'') is null or region = region_filter)
  ), filtered as (
    select * from visits
    where (nullif(country_filter,'') is null or country = country_filter)
      and (nullif(region_filter,'') is null or region = region_filter)
      and (nullif(city_filter,'') is null or city = city_filter)
  ), grouped as (
    select country,region,city,count(*) as page_views,count(distinct session_hash) as visitors
    from filtered group by country,region,city
  ), paged as (
  select * from grouped
  order by
    case when sort_by='visitors' and sort_direction='desc' then visitors end desc,
    case when sort_by='visitors' and sort_direction='asc' then visitors end asc,

    case when sort_by='page_views' and sort_direction='desc' then page_views end desc,
    case when sort_by='page_views' and sort_direction='asc' then page_views end asc,

    case when sort_by='country' and sort_direction='asc' then country end asc,
    case when sort_by='country' and sort_direction='desc' then country end desc,

    case when sort_by='region' and sort_direction='asc' then region end asc,
    case when sort_by='region' and sort_direction='desc' then region end desc,

    case when sort_by='city' and sort_direction='asc' then city end asc,
    case when sort_by='city' and sort_direction='desc' then city end desc,

    country asc, region asc, city asc
  limit page_size offset (page_number - 1) * page_size
)
  select jsonb_build_object(
    'total_page_views',(select count(*) from filtered),
    'total_visitors',(select count(distinct session_hash) from filtered),
    'total_rows',(select count(*) from grouped),
    'countries',coalesce((select jsonb_agg(value order by value) from countries),'[]'::jsonb),
    'regions',coalesce((select jsonb_agg(value order by value) from regions),'[]'::jsonb),
    'cities',coalesce((select jsonb_agg(value order by value) from cities),'[]'::jsonb),
    'rows',coalesce((
  select jsonb_agg(
    to_jsonb(paged)
    order by
      case when sort_by='visitors' and sort_direction='desc' then visitors end desc,
      case when sort_by='visitors' and sort_direction='asc' then visitors end asc,

      case when sort_by='page_views' and sort_direction='desc' then page_views end desc,
      case when sort_by='page_views' and sort_direction='asc' then page_views end asc,

      case when sort_by='country' and sort_direction='asc' then country end asc,
      case when sort_by='country' and sort_direction='desc' then country end desc,

      case when sort_by='region' and sort_direction='asc' then region end asc,
      case when sort_by='region' and sort_direction='desc' then region end desc,

      case when sort_by='city' and sort_direction='asc' then city end asc,
      case when sort_by='city' and sort_direction='desc' then city end desc,

      country asc, region asc, city asc
  )
  from paged
), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.get_visitor_location_analytics(date,date,text,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.get_visitor_location_analytics(date,date,text,text,text,text,text,integer,integer) to authenticated;

commit;
