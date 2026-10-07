-- Privacy-safe visitor summaries from the existing analytics event stream.
create or replace function public.get_visitor_analytics(date_from date, date_to date)
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

  with visits as (
    select created_at::date as day,
      coalesce(nullif(metadata->>'country',''),'Unknown') as country,
      coalesce(nullif(metadata->>'region',''),'Unknown') as region,
      coalesce(nullif(metadata->>'city',''),'Unknown') as city,
      session_hash
    from public.analytics_events
    where event_type = 'page_view'
      and created_at >= date_from::timestamptz
      and created_at < (date_to + 1)::timestamptz
  ), by_day as (
    select day,count(*) as visits,count(distinct session_hash) as visitors
    from visits group by day order by day
  ), by_location as (
    select country,region,city,count(*) as visits,count(distinct session_hash) as visitors
    from visits group by country,region,city order by visitors desc,visits desc limit 100
  )
  select jsonb_build_object(
    'total_visits',(select count(*) from visits),
    'total_visitors',(select count(distinct session_hash) from visits),
    'by_day',coalesce((select jsonb_agg(to_jsonb(by_day) order by day) from by_day),'[]'::jsonb),
    'by_location',coalesce((select jsonb_agg(to_jsonb(by_location) order by visitors desc,visits desc) from by_location),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.get_visitor_analytics(date,date) from public,anon;
grant execute on function public.get_visitor_analytics(date,date) to authenticated;
