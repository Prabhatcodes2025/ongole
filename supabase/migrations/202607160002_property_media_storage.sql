-- Private property media: only authenticated owners and authorised staff can read it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media', 'property-media', false, 10485760, array['image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy property_media_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2] and p.owner_id = auth.uid() and p.status in ('draft', 'changes_requested'))
);

create policy property_media_owner_read on storage.objects for select to authenticated
using (bucket_id = 'property-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_permission('properties.read')));

create policy property_media_owner_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2] and p.owner_id = auth.uid() and p.status in ('draft', 'changes_requested'))
);

create policy property_media_admin_manage on storage.objects for all to authenticated
using (bucket_id = 'property-media' and public.has_permission('properties.update'))
with check (bucket_id = 'property-media' and public.has_permission('properties.update'));
