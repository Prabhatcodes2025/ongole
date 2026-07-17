-- Sprint 1: non-destructive normalized area support for consistent public filtering.
create or replace function public.area_to_sq_ft(area_value numeric, area_unit text)
returns numeric language sql immutable strict set search_path = public as $$
  select area_value * case area_unit
    when 'gadi' then 9
    when 'sq_ft' then 1
    when 'sq_yd' then 9
    when 'sq_m' then 10.763910416709722
    when 'acre' then 43560
    when 'cent' then 435.6
    when 'gunta' then 1089
    when 'hectare' then 107639.10416709722
    else null end
$$;

alter table public.properties drop constraint if exists properties_area_unit_check;
alter table public.properties add constraint properties_area_unit_check check (area_unit in ('gadi','sq_ft','sq_yd','sq_m','acre','cent','gunta','hectare'));
alter table public.properties add column if not exists area_sq_ft numeric(18,4) generated always as (public.area_to_sq_ft(area_value, area_unit)) stored;
create index if not exists properties_public_area_idx on public.properties(area_sq_ft) where status = 'published' and deleted_at is null;
