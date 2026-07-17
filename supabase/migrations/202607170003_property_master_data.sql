update public.property_categories
set slug='agricultural'
where slug='agricultural-farm-land'
  and not exists (select 1 from public.property_categories where slug='agricultural');

insert into public.property_types(category_id,name,slug)
select c.id,v.name,v.slug from public.property_categories c cross join (values
  ('residential','Independent House','independent-house'),
  ('residential','Apartment / Flat','apartment-flat'),
  ('residential','Villa','villa'),
  ('residential','Open Plot','open-plot'),
  ('commercial','Shop','shop'),
  ('commercial','Office','office'),
  ('commercial','Shopping Complex','shopping-complex'),
  ('commercial','Commercial Open Plot','commercial-open-plot'),
  ('agricultural','Agricultural Land','agricultural-land'),
  ('agricultural','Farm Land','farm-land')
) as v(category_slug,name,slug)
where c.slug=v.category_slug
on conflict (slug) do update set name=excluded.name,category_id=excluded.category_id,is_active=true;

update public.properties p
set category_id=c.id
from public.property_categories c
where p.category_id is null and c.slug=p.details->>'category';

update public.properties p
set property_type_id=t.id,
    details=jsonb_set(p.details,'{property_type_slug}',to_jsonb(t.slug),true)
from public.property_types t
where p.property_type_id is null
  and lower(regexp_replace(trim(p.details->>'property_type'),'[^a-zA-Z0-9]+','-','g'))=t.slug;
