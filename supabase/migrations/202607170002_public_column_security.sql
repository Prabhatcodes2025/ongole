-- Sprint 1: prevent anonymous PostgREST clients from selecting owner IDs,
-- exact coordinates, approval metadata or private Storage paths.
revoke select on public.properties from anon;
grant select (
  id, reference_no, category_id, property_type_id, transaction_type, title,
  description, slug, status, location_id, locality_text, city_text,
  district_text, state_text, price_inr, area_value, area_unit, area_sq_ft,
  details, is_verified, is_featured, is_premium, contact_visibility,
  published_at, expires_at, created_at, updated_at, deleted_at
) on public.properties to anon;

revoke select on public.property_media from anon;
grant execute on function public.get_property_contact(uuid) to anon, authenticated;

create or replace function public.get_public_property_map(target_property uuid)
returns table(latitude numeric, longitude numeric)
language sql stable security definer set search_path = public as $$
  select p.latitude, p.longitude from public.properties p
  where p.id = target_property and p.status = 'published' and p.deleted_at is null
    and p.is_premium = true and p.latitude is not null and p.longitude is not null
$$;
grant execute on function public.get_public_property_map(uuid) to anon, authenticated;
