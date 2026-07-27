insert into public.roles(code,name,description,is_system) values
('super_admin','Super Administrator','Full platform control',true),
('property_manager','Property Manager','Review and manage property and PG listings',true),
('enquiry_manager','Enquiry Manager','Manage enquiries and site visits',true),
('content_manager','Content & SEO Manager','Manage website content and SEO',true),
('analyst','Reports Analyst','Read analytics and export reports',true),
('admin','Administrator','General platform administrator',true),
('pg_manager','PG Manager','Review and manage paying guest listings',true),
('finance_manager','Finance Manager','Manage subscriptions, payments and refunds',true),
('support_manager','Support Manager','Support users, subscriptions and notifications',true),
('read_only_admin','Read-only Administrator','Read operational and financial data',true)
on conflict (code) do nothing;

insert into public.permissions(code,module,description) values
('properties.read','properties','View private and pending properties'),
('properties.manage','properties','Create, edit, approve, publish and archive properties'),
('enquiries.read','enquiries','View enquiries'),
('enquiries.manage','enquiries','Assign and update enquiries'),
('users.read','users','View user profiles'),
('users.manage','users','Manage user status'),
('agents.read','agents','View private agent applications'),
('agents.manage','agents','Verify and manage agents'),
('settings.manage','settings','Manage website and feature settings'),
('seo.manage','seo','Manage SEO, redirects, sitemaps and robots'),
('analytics.read','analytics','View analytics and reports'),
('audit.read','audit','View protected audit logs'),
('roles.manage','roles','Manage admin roles and permissions'),
('pg.read','paying_guest','View private and review-stage PG listings'),
('pg.manage','paying_guest','Review, approve, publish and administer PG listings'),
('plans.read','billing','View subscription plans'),
('plans.manage','billing','Create and manage subscription plans'),
('subscriptions.read','billing','View subscriptions'),
('subscriptions.manage','billing','Activate, pause and cancel subscriptions'),
('payments.read','finance','View payments and invoices'),
('payments.manage','finance','Manage and reconcile payments'),
('refunds.manage','finance','Create and manage refunds'),
('promotions.read','monetization','View promotion products and activations'),
('promotions.manage','monetization','Manage promotion products and activations'),
('reports.read','reports','View and export reports'),
('notifications.manage','notifications','Manage notification templates and deliveries')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code = 'super_admin'
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r
join public.permissions p on
  (r.code='property_manager' and p.code in ('properties.read','properties.manage','agents.read','agents.manage','audit.read'))
  or (r.code='enquiry_manager' and p.code in ('enquiries.read','enquiries.manage','users.read'))
  or (r.code='content_manager' and p.code in ('settings.manage','seo.manage'))
  or (r.code='analyst' and p.code in ('analytics.read','reports.read','audit.read'))
  or (r.code='admin' and p.code in ('properties.read','properties.manage','pg.read','pg.manage','enquiries.read','enquiries.manage','users.read','plans.read','subscriptions.read','payments.read','promotions.read','analytics.read','reports.read','audit.read'))
  or (r.code='pg_manager' and p.code in ('pg.read','pg.manage','enquiries.read','plans.read','subscriptions.read','promotions.read','analytics.read','reports.read','audit.read'))
  or (r.code='finance_manager' and p.code in ('users.read','plans.read','plans.manage','subscriptions.read','subscriptions.manage','payments.read','payments.manage','refunds.manage','promotions.read','promotions.manage','analytics.read','reports.read','audit.read'))
  or (r.code='support_manager' and p.code in ('users.read','enquiries.read','enquiries.manage','plans.read','subscriptions.read','payments.read','notifications.manage','audit.read'))
  or (r.code='read_only_admin' and p.code in ('properties.read','pg.read','enquiries.read','users.read','plans.read','subscriptions.read','payments.read','promotions.read','analytics.read','reports.read','audit.read'))
on conflict do nothing;

insert into public.property_categories(name,slug,sort_order) values
('Residential','residential',10),('Commercial','commercial',20),('Agricultural & Farm Land','agricultural',30),('Industrial','industrial',40),('Rental & Lease','rental-lease',50)
on conflict (slug) do nothing;

insert into public.property_types(category_id,name,slug)
select c.id,v.name,v.slug from public.property_categories c cross join (values
('residential','Independent House','independent-house'),('residential','Apartment / Flat','apartment-flat'),('residential','Villa','villa'),('residential','Open Plot','open-plot'),
('commercial','Shop','shop'),('commercial','Office','office'),('commercial','Shopping Complex','shopping-complex'),('commercial','Commercial Open Plot','commercial-open-plot'),
('agricultural','Agricultural Land','agricultural-land'),('agricultural','Farm Land','farm-land')
) as v(category_slug,name,slug) where c.slug=v.category_slug
on conflict (slug) do nothing;

insert into public.locations(type,name,slug,is_active,sort_order)
select v.type,v.name,v.slug,true,v.sort_order
from (values
  ('locality','Bhagya Nagar','bhagya-nagar',10),
  ('locality','Bhagyanagar','bhagyanagar',11),
  ('locality','Gopal Nagar','gopal-nagar',20),
  ('locality','Pernamitta','pernamitta',30),
  ('locality','Lawyer Pet','lawyer-pet',40),
  ('locality','Mangamuru Road','mangamuru-road',50),
  ('locality','Kurnool Road','kurnool-road',60),
  ('locality','Pelluru','pelluru',70)
) as v(type,name,slug,sort_order)
where not exists (select 1 from public.locations l where l.slug=v.slug and l.deleted_at is null);

insert into public.master_items(kind,name,slug,sort_order) values
('amenity','Parking','parking',10),('amenity','Power Backup','power-backup',20),('amenity','Lift','lift',30),('amenity','Security','security',40),('amenity','Water Supply','water-supply',50),('amenity','Road Access','road-access',60),
('facing','East','east',10),('facing','West','west',20),('facing','North','north',30),('facing','South','south',40),('facing','North East','north-east',50),
('ownership','Freehold','freehold',10),('ownership','Leasehold','leasehold',20),
('advertisement_type','Hero Banner','hero-banner',10),('advertisement_type','Flash Advertisement','flash',20),('advertisement_type','Scrolling Advertisement','scrolling',30),('advertisement_type','Sidebar Advertisement','sidebar',40)
on conflict(kind,slug) do nothing;

insert into public.feature_flags(key,enabled,configuration) values
('memberships_public',false,'{}'),('online_payments',false,'{}'),('blog',true,'{}'),('paying_guest',true,'{}'),('agent_network',true,'{}'),('social_auto_publish',false,'{"queue_required":true}')
on conflict (key) do nothing;

insert into public.website_settings(key,value,is_public) values
('contact','{"voice":"+91 77889 98459","whatsapp":"+91 99887 67689","email":"admin@ongoleproperty.com"}',true),
('business','{"legal_name":"Kosana Associates LLP","since":2002,"hours":"24x7"}',true)
on conflict (key) do nothing;

-- Promote the first administrator after they register:
-- insert into public.user_roles(user_id, role_id, assigned_by)
-- select '<AUTH_USER_UUID>', id, '<AUTH_USER_UUID>' from public.roles where code = 'super_admin';
