-- Filter and sort before pagination, keeping private trips out of every view.
create function trip_private.filtered_directory(p_offset integer default 0,p_status text default 'all',p_order text default 'newest')
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by
 case when p_order='oldest' then started_at end asc,
 case when p_order<>'oldest' then started_at end desc,session_id),'[]'::jsonb)
 from (
 select s.started_at,t.session_id,
 jsonb_build_object('token',t.token,'title',t.title,'boat',b.name,'live',t.live,
 'startedAt',s.started_at,'stoppedAt',s.stopped_at,'color',b.tracking_color) item
 from public.trip_shares t
 join public.tracking_sessions s on s.id=t.session_id
 join public.boats b on b.id=s.boat_id
 where t.visibility='public'
 and (not t.live or (s.stopped_at is null and s.expires_at>now()))
 and not exists(select 1 from public.account_security where user_id=s.user_id and suspended)
 and (p_status='all' or (p_status='active' and t.live) or (p_status='past' and not t.live))
 order by case when p_order='oldest' then s.started_at end asc,
 case when p_order<>'oldest' then s.started_at end desc,t.session_id
 limit 50 offset greatest(0,least(p_offset,10000))
 ) rows;
$$;
drop function public.public_trips(integer);
create function public.public_trips(p_offset integer default 0,p_status text default 'all',p_order text default 'newest')
returns jsonb language sql stable security invoker set search_path='' as $$
 select trip_private.filtered_directory(p_offset,p_status,p_order);
$$;
revoke all on function trip_private.filtered_directory(integer,text,text),public.public_trips(integer,text,text) from public;
grant execute on function trip_private.filtered_directory(integer,text,text),public.public_trips(integer,text,text) to anon,authenticated;
