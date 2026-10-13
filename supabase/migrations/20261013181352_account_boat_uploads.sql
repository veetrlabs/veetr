-- Private account copies never enter the public race boat directory.
create function public.valid_account_boat_profile(profile jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text;
begin
 if profile is null or jsonb_typeof(profile)<>'object' or pg_column_size(profile)>2100000 then return false; end if;
 if jsonb_typeof(profile->'name') is distinct from 'string' or length(trim(profile->>'name')) not between 1 and 120 then return false; end if;
 foreach k in array array['className','catalogId','catalogRevision','catalogLabel'] loop
  if profile ? k and (jsonb_typeof(profile->k)<>'string' or length(profile->>k)>500) then return false; end if;
 end loop;
 if profile ? 'className' and length(profile->>'className')>120 then return false; end if;
 foreach k in array array['lengthM','weightKg'] loop
  if profile ? k then
   if jsonb_typeof(profile->k)<>'number' then return false; end if;
   if (profile->>k)::numeric<=0 or (profile->>k)::numeric>=(case k when 'lengthM' then 201 else 1000000000 end) then return false; end if;
  end if;
 end loop;
 if profile ? 'lengthM' and (profile->>'lengthM')::numeric>200 then return false; end if;
 if profile ? 'lengthM' and profile ? 'waterlineLengthM' and (profile->>'waterlineLengthM')::numeric>(profile->>'lengthM')::numeric then return false; end if;
 return public.valid_boat_specifications(profile-'name'-'className'-'lengthM'-'weightKg'-'catalogId'-'catalogRevision'-'catalogLabel');
end $$;
create table public.account_boats (
 user_id uuid not null references auth.users(id) on delete cascade,
 boat_id uuid not null,
 profile jsonb not null check(public.valid_account_boat_profile(profile)),
 updated_at timestamptz not null default now(),
 last_upload_public boolean not null default false,
 primary key(user_id,boat_id)
);
alter table public.account_boats enable row level security;
revoke all on public.account_boats from public,anon,authenticated;
grant select on public.account_boats to authenticated;
create policy account_boats_read on public.account_boats for select to authenticated
 using(user_id=(select auth.uid()) and public.account_access_allowed());

create function public.my_account_boats() returns jsonb language sql stable security definer set search_path='' as $$
 with owned as (select value as document from jsonb_array_elements(public.my_owned_boats())),
 combined as (
  select coalesce(a.boat_id,(o.document->>'id')::uuid) as id,
   case when o.document is not null and (a.updated_at is null or (o.document->>'updatedAt')::timestamptz>a.updated_at)
    then o.document-'id'-'updatedAt' else a.profile end as profile,
   a.updated_at as private_updated, o.document->>'updatedAt' as public_updated,
   greatest(a.updated_at,(o.document->>'updatedAt')::timestamptz) as updated_at,
   coalesce(a.last_upload_public,true) as upload_public
  from (select * from public.account_boats where user_id=auth.uid()) a
  full join owned o on (o.document->>'id')::uuid=a.boat_id
 )
 select case when public.account_access_allowed() then coalesce((select jsonb_agg(profile || jsonb_build_object(
  'id',id,'updatedAt',updated_at,'privateUpdatedAt',private_updated,'publicUpdatedAt',public_updated,
  'publiclyVisible',public_updated is not null,'uploadPublic',upload_public) order by profile->>'name',id) from combined),'[]'::jsonb) else '[]'::jsonb end;
$$;
create function public.upload_account_boat(bid uuid, profile jsonb, publish boolean default false, expected_private timestamptz default null, expected_public timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.account_boats;
begin
 perform public.require_active_account();
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before uploading a boat.'; end if;
 if not public.valid_account_boat_profile(profile) then raise exception 'Invalid boat specifications or polar data.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||bid::text,0));
 select * into previous from public.account_boats where user_id=auth.uid() and boat_id=bid for update;
 if previous.updated_at is distinct from expected_private then
  -- A retry of the same completed upload is harmless; a different revision is not.
  if previous.profile=profile and previous.last_upload_public=publish then
   return (select value from jsonb_array_elements(public.my_account_boats()) where value->>'id'=bid::text);
  end if;
  raise exception 'Boat changed elsewhere. Refresh your boats before uploading again.';
 end if;
 if publish then
  if expected_public is null and exists(select 1 from public.boats where id=bid) then raise exception 'Boat changed elsewhere. Refresh your boats before uploading again.'; end if;
  perform public.publish_private_boat(bid,profile-'catalogId'-'catalogRevision'-'catalogLabel',expected_public);
 end if;
 insert into public.account_boats(user_id,boat_id,profile,last_upload_public) values(auth.uid(),bid,profile,publish)
 on conflict(user_id,boat_id) do update set profile=excluded.profile,last_upload_public=excluded.last_upload_public,updated_at=now();
 return (select value from jsonb_array_elements(public.my_account_boats()) where value->>'id'=bid::text);
end $$;
revoke all on function public.my_account_boats(),public.upload_account_boat(uuid,jsonb,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.my_account_boats(),public.upload_account_boat(uuid,jsonb,boolean,timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
