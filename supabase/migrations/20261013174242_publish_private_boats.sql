-- Ownership is account based and independent of race/tracking participation.
create function public.my_owned_boats() returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.account_access_allowed() then coalesce((select jsonb_agg(
  jsonb_strip_nulls(jsonb_build_object('id',b.id,'name',b.name,'className',b.class_name,'lengthM',b.length_m,'weightKg',b.weight_kg,'updatedAt',b.updated_at)) || b.specifications order by b.name,b.id)
  from public.boats b where b.owner_id=auth.uid()),'[]'::jsonb) else '[]'::jsonb end;
$$;
create function public.publish_private_boat(bid uuid, profile jsonb, expected timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.boats; details jsonb; base jsonb;
begin
 perform public.require_active_account();
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before publishing a boat.'; end if;
 if profile is null or jsonb_typeof(profile)<>'object' or jsonb_typeof(profile->'name') is distinct from 'string' or length(trim(profile->>'name')) not between 1 and 120 then raise exception 'Enter a boat name (up to 120 characters).'; end if;
 if profile ? 'className' and (jsonb_typeof(profile->'className')<>'string' or length(profile->>'className')>120) then raise exception 'Invalid boat class.'; end if;
 if profile ? 'lengthM' then
  if jsonb_typeof(profile->'lengthM')<>'number' then raise exception 'Enter a valid boat length.'; end if;
  if (profile->>'lengthM')::numeric<=0 or (profile->>'lengthM')::numeric>200 then raise exception 'Enter a valid boat length.'; end if;
 end if;
 if profile ? 'weightKg' then
  if jsonb_typeof(profile->'weightKg')<>'number' then raise exception 'Enter a valid boat weight.'; end if;
  if (profile->>'weightKg')::numeric<=0 or (profile->>'weightKg')::numeric>=1000000000 then raise exception 'Enter a valid boat weight.'; end if;
 end if;
 details:=profile-'name'-'className'-'lengthM'-'weightKg';
 if not public.valid_boat_specifications(details) then raise exception 'Invalid boat specifications or polar data.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(bid::text,0));
 select * into b from public.boats where id=bid for update;
 if found then
  if b.owner_id is distinct from auth.uid() then raise exception 'This race boat belongs to another account. Accept its ownership invitation before publishing changes.'; end if;
  -- A retry after a lost creation response must not duplicate or overwrite the boat.
  if expected is null then
   return (select value from jsonb_array_elements(public.my_owned_boats()) where value->>'id'=bid::text);
  end if;
  if b.updated_at is distinct from expected then raise exception 'Boat changed elsewhere. Refresh your boats before publishing again.'; end if;
  base:=jsonb_strip_nulls(jsonb_build_object('id',b.id,'name',b.name,'className',b.class_name,'length',b.length_m,'weightKg',b.weight_kg,'trackingColor',b.tracking_color));
 else
  if expected is not null then raise exception 'Boat no longer available. Refresh your boats.'; end if;
 end if;
 -- Clear dimensions before changing the overall length; the full transaction is atomic.
 if b.id is not null then update public.boats set specifications='{}'::jsonb where id=bid; end if;
 perform public.save_boat_profile(bid,trim(profile->>'name'),coalesce(profile->>'className',''),(profile->>'lengthM')::numeric,(profile->>'weightKg')::numeric,b.tracking_color,base);
 perform public.save_boat_specifications(bid,details,'{}'::jsonb);
 return (select value from jsonb_array_elements(public.my_owned_boats()) where value->>'id'=bid::text);
end $$;
revoke all on function public.my_owned_boats(),public.publish_private_boat(uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.my_owned_boats(),public.publish_private_boat(uuid,jsonb,timestamptz) to authenticated;

-- Invitation tokens already authorize preview; expose the public boat link as well.
do $$ declare definition text; begin
 select pg_get_functiondef('public.boat_invitation_preview(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''boat'', b.name','''boatId'', b.id, ''boat'', b.name');
 definition:=replace(definition,'''boat'',b.name','''boatId'',b.id,''boat'',b.name');
 execute definition;
end $$;
notify pgrst, 'reload schema';
