-- Offline document saves must enforce the same deletion permissions as the delete action.
create function public.protect_entity_removal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.is_official(old.id,true) and (
   exists(select 1 from jsonb_array_elements(old.document->'races') r where not exists(select 1 from jsonb_array_elements(new.document->'races') n where n->>'id'=r->>'id'))
   or exists(select 1 from jsonb_array_elements(coalesce(old.document->'events','[]')) e where not exists(select 1 from jsonb_array_elements(coalesce(new.document->'events','[]')) n where n->>'id'=e->>'id'))
 ) then raise exception 'Series admin required'; end if;
 return new;
end $$;
create trigger protect_entity_removal before update on public.series for each row execute function public.protect_entity_removal();
revoke all on function public.protect_entity_removal() from public;
