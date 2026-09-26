create or replace function trip_private.write_trip(action text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.tracking_sessions; t public.trip_shares; bid uuid; point jsonb; instr jsonb; k text; n numeric; stamp timestamptz; count_points integer:=0; selected_visibility text;
begin
 perform public.require_active_account();
 if not exists(select 1 from auth.users u where u.id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Verify your email before sharing trips'; end if;
 if action='create' then
  bid:=(payload->>'boatId')::uuid;
  if not exists(select 1 from public.tracking_sessions where id=(payload->>'id')::uuid) and not exists(select 1 from public.boats b where b.id=bid and (b.owner_id=auth.uid() or exists(select 1 from public.boat_members m where m.boat_id=b.id and m.user_id=auth.uid()))) then raise exception 'Boat skipper or crew access required'; end if;
  if (payload->>'startedAt')::timestamptz > now()+interval '30 seconds' or payload->>'startedAt' is null then raise exception 'Invalid trip start'; end if;
  if payload->>'stoppedAt' is not null and ((payload->>'stoppedAt')::timestamptz < (payload->>'startedAt')::timestamptz or (payload->>'stoppedAt')::timestamptz>now()+interval '30 seconds') then raise exception 'Invalid trip end'; end if;
  insert into public.tracking_sessions(id,boat_id,user_id,started_at,expires_at,stopped_at)
  values((payload->>'id')::uuid,bid,auth.uid(),(payload->>'startedAt')::timestamptz,
   greatest((payload->>'startedAt')::timestamptz+interval '12 hours',coalesce((payload->>'stoppedAt')::timestamptz,(payload->>'startedAt')::timestamptz)+interval '1 second'),(payload->>'stoppedAt')::timestamptz)
  on conflict(id) do nothing;
 end if;
 select * into s from public.tracking_sessions where id=(payload->>'id')::uuid for update;
 if not found or s.user_id<>auth.uid() or s.series_id is not null then raise exception 'Trip owner required' using errcode='42501'; end if;
 if action='create' then
  if s.boat_id<>bid then raise exception 'Trip boat cannot be changed after upload'; end if;
  insert into public.trip_shares(session_id,title) values(s.id,coalesce(nullif(btrim(payload->>'title'),''),'My sailing trip')) on conflict(session_id) do nothing;
 end if;
 select * into t from public.trip_shares where session_id=s.id for update;
 if not found then raise exception 'Not a personal trip'; end if;
 if action='ingest' then
  if t.visibility<>'private' and not t.live then raise exception 'Unpublish before changing a finished trip'; end if;
  if jsonb_typeof(payload->'points') is distinct from 'array' or jsonb_array_length(payload->'points')>500 then raise exception 'Invalid point batch'; end if;
  for point in select value from jsonb_array_elements(payload->'points') loop
   stamp:=(point->>'recordedAt')::timestamptz;
   if stamp is null or stamp<s.started_at-interval '1 minute' or stamp>least(s.expires_at,coalesce(s.stopped_at,s.expires_at),now()+interval '30 seconds') then raise exception 'Point outside trip'; end if;
   instr:=point->'instruments';
   if instr='null'::jsonb then instr:=null; end if;
   if instr is not null then
    if jsonb_typeof(instr)<>'object' then raise exception 'Invalid instruments'; end if;
    for k in select jsonb_object_keys(instr) loop
     if k not in ('aws','tws','awa','twa','heading') then raise exception 'Unknown instrument'; end if;
     if instr->k <> 'null'::jsonb then
      if jsonb_typeof(instr->k)<>'number' then raise exception 'Invalid instrument value'; end if;
      n:=(instr->>k)::numeric;
      if (k in ('aws','tws') and (n<0 or n>200)) or (k in ('awa','twa') and abs(n)>180) or (k='heading' and (n<0 or n>=360)) then raise exception 'Instrument out of range'; end if;
     end if;
    end loop;
   end if;
   insert into public.tracking_points(session_id,seq,recorded_at,latitude,longitude,accuracy_m,sog_mps,cog_deg,source,instruments)
   values(s.id,(point->>'seq')::bigint,stamp,(point->>'latitude')::float8,(point->>'longitude')::float8,(point->>'accuracyM')::float8,(point->>'sogMps')::float8,(point->>'cogDeg')::float8,point->>'source',instr)
   on conflict(session_id,seq) do nothing;
   count_points:=count_points+1;
  end loop;
  return to_jsonb(count_points);
 elsif action='publish' then
  selected_visibility:=payload->>'visibility';
  if selected_visibility is null or selected_visibility not in ('private','unlisted','public') then raise exception 'Invalid visibility'; end if;
  if selected_visibility<>'private' and not exists(select 1 from public.tracking_points where session_id=s.id) then raise exception 'Record a position before sharing'; end if;
  if selected_visibility<>'private' and s.stopped_at is null and s.expires_at<=now() then raise exception 'Finish this expired trip before publishing'; end if;
  update public.trip_shares set title=coalesce(nullif(btrim(payload->>'title'),''),title),visibility=selected_visibility,
   live=(selected_visibility<>'private' and s.stopped_at is null),
   token=case when selected_visibility='private' and visibility<>'private' then gen_random_uuid() else token end,updated_at=now() where session_id=s.id;
 elsif action='finish' then
  stamp:=(payload->>'stoppedAt')::timestamptz;
  if stamp is null or stamp<s.started_at or stamp>now()+interval '30 seconds' then raise exception 'Invalid trip end'; end if;
  update public.tracking_sessions set stopped_at=coalesce(stopped_at,least(stamp,expires_at)) where id=s.id;
  -- Finishing changes recording status only; visibility and the shared URL persist.
  update public.trip_shares set live=false,updated_at=now() where session_id=s.id and live;
 elsif action not in ('create','get') then raise exception 'Unknown trip action';
 end if;
 return (select jsonb_build_object('id',session_id,'token',token,'visibility',visibility,'live',live,'title',title) from public.trip_shares where session_id=s.id);
end $$;
