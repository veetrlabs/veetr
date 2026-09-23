alter table public.boats add column weight_kg numeric check(weight_kg > 0 and weight_kg < 1000000000);
alter table public.boats add column tracking_color text check(tracking_color ~ '^#[0-9a-f]{6}$');

create function public.assign_boat_color() returns trigger language plpgsql security definer set search_path='' as $$
declare candidate text;
begin
 perform pg_advisory_xact_lock(736821902);
 if new.tracking_color is null then
  foreach candidate in array ARRAY['#007f73','#2563eb','#dc2626','#9333ea','#d97706','#db2777','#0891b2','#4d7c0f','#4f46e5','#be123c','#0e7490','#a16207','#7e22ce','#15803d','#c2410c','#475569'] loop
   if not exists(select 1 from public.boats where tracking_color=candidate and id<>new.id) then new.tracking_color:=candidate; exit; end if;
  end loop;
  while new.tracking_color is null loop
   candidate:='#'||substr(md5(gen_random_uuid()::text),1,6);
   if not exists(select 1 from public.boats where tracking_color=candidate and id<>new.id) then new.tracking_color:=candidate; end if;
  end loop;
 else new.tracking_color:=lower(new.tracking_color);
 end if;
 if exists(select 1 from public.boats where tracking_color=new.tracking_color and id<>new.id) then raise exception 'This tracking color is already used by another boat. Choose a different color.'; end if;
 return new;
end $$;
revoke all on function public.assign_boat_color() from public,anon,authenticated;
create trigger assign_boat_color before insert or update of tracking_color on public.boats for each row execute function public.assign_boat_color();
update public.boats set tracking_color=null;
alter table public.boats alter column tracking_color set not null;
create unique index boats_tracking_color_unique on public.boats(tracking_color);

create or replace function public.boat_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'name',name,'className',class_name,'length',length_m,'weightKg',weight_kg,'trackingColor',tracking_color)) order by name,id),'[]'::jsonb) from public.boats;
$$;

create function public.save_boat_profile(boat_id uuid, boat_name text, boat_class text, boat_length numeric, boat_weight numeric, boat_color text, expected jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.boats;
begin
 perform public.require_active_account();
 if expected is null then
  perform public.create_boat(boat_id,boat_name,boat_class,boat_length);
 else
  select * into b from public.boats where id=boat_id for update;
  if not public.can_edit_boat(boat_id) then raise exception 'Boat owner or editor required'; end if;
  if jsonb_strip_nulls(jsonb_build_object('weightKg',b.weight_kg,'trackingColor',b.tracking_color)) is distinct from jsonb_strip_nulls(jsonb_build_object('weightKg',expected->'weightKg','trackingColor',expected->'trackingColor')) then raise exception 'Boat changed elsewhere. Cancel and reopen the editor to load the latest details.'; end if;
  perform public.update_boat(boat_id,boat_name,boat_class,boat_length,expected-'weightKg'-'trackingColor');
 end if;
 update public.boats set weight_kg=boat_weight,tracking_color=coalesce(boat_color,tracking_color),updated_at=now() where id=boat_id;
 return (select jsonb_strip_nulls(jsonb_build_object('id',id,'name',name,'className',class_name,'length',length_m,'weightKg',weight_kg,'trackingColor',tracking_color)) from public.boats where id=boat_id);
end $$;
revoke all on function public.save_boat_profile(uuid,text,text,numeric,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_boat_profile(uuid,text,text,numeric,numeric,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
