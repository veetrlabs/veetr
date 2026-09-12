alter table public.series add column slug text unique;
alter table public.boats add column slug text unique;
create function public.assign_entity_slug() returns trigger language plpgsql security definer set search_path='' as $$
declare base text; candidate text; taken boolean; n integer:=1;
begin
 if TG_OP='UPDATE' and OLD.slug is not null then NEW.slug:=OLD.slug; return NEW; end if;
 base:=trim(both '-' from regexp_replace(translate(lower(NEW.name),'áčďéěíňóřšťúůýž','acdeeinorstuuyz'),'[^a-z0-9]+','-','g'));
 if base='' then base:='entry'; end if;
 if TG_TABLE_NAME='series' then
  if base !~ ('(^|-)' || (to_jsonb(NEW)->>'year') || '$') then base:=base || '-' || (to_jsonb(NEW)->>'year'); end if;
 end if;
 perform pg_advisory_xact_lock(11092026);
 candidate:=base;
 loop
  execute format('select exists(select 1 from public.%I where slug=$1 and id<>$2)',TG_TABLE_NAME) into taken using candidate,NEW.id;
  exit when not taken;
  n:=n+1; candidate:=base || '-' || n;
 end loop;
 NEW.slug:=candidate; return NEW;
end $$;
create trigger series_slug before insert or update on public.series for each row execute function public.assign_entity_slug();
create trigger boat_slug before insert or update on public.boats for each row execute function public.assign_entity_slug();
update public.series set slug=null;
update public.boats set slug=null;
alter table public.series alter column slug set not null;
alter table public.boats alter column slug set not null;
create function public.public_entity_routes() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'series',coalesce((select jsonb_object_agg(s.id,s.slug) from public.series s where exists(select 1 from jsonb_array_elements(public.public_series_directory()) d where d->>'id'=s.id::text)),'{}'::jsonb),
 'boats',coalesce((select jsonb_object_agg(b.id,b.slug) from public.boats b where exists(select 1 from jsonb_array_elements(public.boat_directory()) d where d->>'id'=b.id::text)),'{}'::jsonb));
$$;
revoke all on function public.assign_entity_slug(),public.public_entity_routes() from public;
grant execute on function public.public_entity_routes() to anon,authenticated;
