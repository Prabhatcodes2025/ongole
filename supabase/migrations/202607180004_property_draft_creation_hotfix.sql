-- Restore authenticated draft creation after table grants were added without the
-- sequence privilege required by properties.reference_no's nextval() default.

grant usage, select on sequence public.property_reference_seq to authenticated;

-- Reassert the least-privilege table operations used by the owner workflow. RLS
-- remains the authority for individual rows; anonymous users receive no writes.
grant select, insert, update on public.properties to authenticated;

-- Initial history is part of the property insert transaction. If it cannot be
-- written, PostgreSQL rolls the parent insert back instead of leaving a partial draft.
create or replace function public.record_initial_property_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'draft' then
    raise exception 'initial_property_status_must_be_draft';
  end if;
  insert into public.property_status_history(property_id,from_status,to_status,changed_by,reason)
  values(new.id,null,'draft',new.owner_id,'Property draft created');
  return new;
end $$;

revoke all on function public.record_initial_property_history() from public;
drop trigger if exists property_draft_initial_history on public.properties;
create trigger property_draft_initial_history
after insert on public.properties
for each row execute function public.record_initial_property_history();

-- Keep the existing owner isolation explicit and idempotent.
drop policy if exists properties_owner_insert on public.properties;
create policy properties_owner_insert on public.properties for insert
with check (owner_id = auth.uid() and status = 'draft');

drop policy if exists properties_owner_update_draft on public.properties;
create policy properties_owner_update_draft on public.properties for update
using (owner_id = auth.uid() and status in ('draft','changes_requested'))
with check (owner_id = auth.uid() and status in ('draft','pending_review'));
