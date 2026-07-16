insert into public.roles(code,name,description,is_system) values
('super_admin','Super Administrator','Full platform control',true),
('property_manager','Property Manager','Review and manage property and PG listings',true),
('enquiry_manager','Enquiry Manager','Manage enquiries and site visits',true),
('content_manager','Content & SEO Manager','Manage website content and SEO',true),
('analyst','Reports Analyst','Read analytics and export reports',true)
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
('roles.manage','roles','Manage admin roles and permissions')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code = 'super_admin'
on conflict do nothing;

insert into public.property_categories(name,slug,sort_order) values
('Residential','residential',10),('Commercial','commercial',20),('Agricultural & Farm Land','agricultural-farm-land',30),('Industrial','industrial',40),('Rental & Lease','rental-lease',50)
on conflict (slug) do nothing;

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
