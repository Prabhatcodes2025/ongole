-- Dev/JV uses the existing Open Plot type and price_inr valuation storage.
insert into public.property_categories (name, slug, sort_order)
select 'Property for Development / Joint Venture', 'dev-jv', coalesce(max(sort_order), 0) + 1
from public.property_categories
on conflict (slug) do nothing;
