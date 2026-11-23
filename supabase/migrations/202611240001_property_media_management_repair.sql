-- Atomic, permission-scoped property media changes.
-- Existing owner and storage RLS policies remain unchanged.
begin;

create or replace function public.manage_property_media(
  target_property uuid,
  target_media uuid,
  media_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  property_record public.properties;
  media_record public.property_media;
  adjacent_record public.property_media;
  next_cover uuid;
  permitted boolean:=false;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if media_action not in ('up','down','cover','remove') then raise exception 'invalid_media_action'; end if;

  select * into property_record from public.properties where id=target_property for update;
  if not found then raise exception 'property_not_found'; end if;

  permitted:=public.has_permission('properties.manage')
    or (
      public.has_permission('pg.manage')
      and exists(select 1 from public.pg_listings pg where pg.property_id=target_property)
    )
    or (
      property_record.owner_id=auth.uid()
      and property_record.status in ('draft','changes_requested')
    );
  if not permitted then raise exception 'not_authorized'; end if;

  select * into media_record
    from public.property_media
    where id=target_media and property_id=target_property and media_type='image'
    for update;
  if not found then raise exception 'media_not_found'; end if;

  if media_action in ('up','down') then
    if media_action='up' then
      select * into adjacent_record from public.property_media
        where property_id=target_property and media_type='image'
          and (sort_order<media_record.sort_order or (sort_order=media_record.sort_order and id<media_record.id))
        order by sort_order desc,id desc limit 1 for update;
    else
      select * into adjacent_record from public.property_media
        where property_id=target_property and media_type='image'
          and (sort_order>media_record.sort_order or (sort_order=media_record.sort_order and id>media_record.id))
        order by sort_order,id limit 1 for update;
    end if;
    if found then
      update public.property_media
        set sort_order=case when id=media_record.id then adjacent_record.sort_order else media_record.sort_order end
        where id in (media_record.id,adjacent_record.id);
    end if;
  elsif media_action='cover' then
    update public.property_media set is_cover=false
      where property_id=target_property and media_type='image' and is_cover;
    update public.property_media set is_cover=true where id=target_media;
  else
    delete from public.property_media where id=target_media;
    with ranked as (
      select id,row_number() over(order by sort_order,id)-1 as next_sort_order
      from public.property_media
      where property_id=target_property and media_type='image'
    )
    update public.property_media media
      set sort_order=ranked.next_sort_order
      from ranked where media.id=ranked.id;
    select id into next_cover from public.property_media
      where property_id=target_property and media_type='image' and is_cover limit 1;
    if next_cover is null then
      select id into next_cover from public.property_media
        where property_id=target_property and media_type='image'
        order by sort_order,id limit 1;
      if next_cover is not null then update public.property_media set is_cover=true where id=next_cover; end if;
    end if;
  end if;

  return jsonb_build_object('action',media_action,'media_id',target_media,'adjacent_id',adjacent_record.id,'cover_id',next_cover);
end
$$;

revoke all on function public.manage_property_media(uuid,uuid,text) from public,anon;
grant execute on function public.manage_property_media(uuid,uuid,text) to authenticated;

commit;
