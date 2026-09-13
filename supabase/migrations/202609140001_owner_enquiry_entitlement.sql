-- Owner enquiry contact access follows the existing active subscription and plan entitlement.
create or replace function public.has_my_paid_enquiry_access()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from public.subscriptions s
    join public.plans plan on plan.id=s.plan_id
    where s.user_id=auth.uid()
      and s.status='active'
      and s.starts_at<=now() and s.ends_at>now()
      and plan.is_active and plan.enquiry_access and plan.slug<>'free'
  );
$$;

revoke all on function public.has_my_paid_enquiry_access() from public,anon;
grant execute on function public.has_my_paid_enquiry_access() to authenticated;

-- The old owner SELECT policy exposed every column through direct PostgREST queries.
-- The separate administrator policy remains unchanged.
drop policy if exists enquiry_owner_read on public.enquiries;
create policy enquiry_owner_read on public.enquiries for select to authenticated using (
  public.has_my_paid_enquiry_access()
  and exists (
    select 1 from public.properties p
    where p.id=enquiries.property_id and p.owner_id=auth.uid()
  )
);

-- Free owners can read only aggregate counts grouped by their listing location.
create or replace function public.get_my_enquiry_summary()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with location_counts as (
    select concat_ws(', ',nullif(trim(p.locality_text),''),nullif(trim(p.city_text),'')) as location,
           count(*) as enquiry_count
    from public.enquiries e
    join public.properties p on p.id=e.property_id
    where p.owner_id=auth.uid()
    group by p.locality_text,p.city_text
  )
  select jsonb_build_object(
    'total',coalesce(sum(enquiry_count),0),
    'locations',coalesce(jsonb_agg(jsonb_build_object(
      'location',coalesce(nullif(location,''),'Location not specified'),
      'count',enquiry_count
    ) order by enquiry_count desc),'[]'::jsonb)
  ) from location_counts;
$$;

revoke all on function public.get_my_enquiry_summary() from public,anon;
grant execute on function public.get_my_enquiry_summary() to authenticated;
