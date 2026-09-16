-- Append-only for application roles. Inspect with the Supabase SQL/Table Editor.
-- No foreign keys: evidence must survive deletion of the actor or entity.
create table public.audit_log (
 id bigint generated always as identity primary key,
 occurred_at timestamptz not null default clock_timestamp(),
 transaction_id bigint not null default txid_current(),
 actor_id uuid,
 actor_email text,
 database_role text not null,
 action text not null,
 entity_table text not null,
 entity_key jsonb not null,
 series_id uuid,
 old_values jsonb,
 new_values jsonb,
 metadata jsonb not null default '{}'::jsonb
);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;
revoke all on sequence public.audit_log_id_seq from public, anon, authenticated;
create index audit_log_time_idx on public.audit_log(occurred_at desc);
create index audit_log_actor_idx on public.audit_log(actor_id, occurred_at desc);
create index audit_log_series_idx on public.audit_log(series_id, occurred_at desc);
create index audit_log_transaction_idx on public.audit_log(transaction_id);
create index audit_log_entity_idx on public.audit_log using gin(entity_key);

create function public.capture_audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; row_data jsonb; key_data jsonb;
 sid uuid; actor uuid := auth.uid();
begin
 if TG_OP <> 'INSERT' then before_row := to_jsonb(OLD); end if;
 if TG_OP <> 'DELETE' then after_row := to_jsonb(NEW); end if;
 -- Ignore writes that only touch bookkeeping timestamps.
 if TG_OP = 'UPDATE' and (before_row - 'updated_at') = (after_row - 'updated_at') then return null; end if;
 row_data := coalesce(after_row, before_row);
 select coalesce(jsonb_object_agg(k, row_data->k), '{}'::jsonb) into key_data
 from unnest(TG_ARGV) k;
 sid := case when TG_TABLE_NAME = 'series' then (row_data->>'id')::uuid
             else (row_data->>'series_id')::uuid end;
 if sid is null and row_data ? 'race_id' then
   select r.series_id into sid from public.races r where r.id=(row_data->>'race_id')::uuid;
 end if;
 -- series.document preserves race/heat details, imports, publishing and results.
 -- The change ledger supplies the mutation ID without duplicating its document.
 if TG_TABLE_NAME = 'series_changes' then
   before_row := before_row - 'document'; after_row := after_row - 'document';
 end if;
 insert into public.audit_log(actor_id,actor_email,database_role,action,entity_table,entity_key,series_id,old_values,new_values)
 values(actor,(select email from auth.users where id=actor),coalesce(nullif(current_setting('role',true),'none'),session_user),
 lower(TG_OP),TG_TABLE_NAME,key_data,sid,before_row,after_row);
 return null;
end;
$$;
revoke all on function public.capture_audit_change() from public, anon, authenticated;

do $$
declare entry record;
begin
 for entry in select * from (values
 ('series',array['id']), ('boats',array['id']), ('boat_members',array['boat_id','user_id']),
 ('race_officials',array['series_id','user_id']), ('race_categories',array['id']),
 ('series_entries',array['series_id','boat_id']), ('races',array['id']),
 ('race_entries',array['race_id','boat_id']), ('race_results',array['race_id','boat_id']),
 ('series_changes',array['series_id','mutation_id']), ('deleted_series',array['id']),
 ('platform_admins',array['user_id']), ('series_creators',array['user_id']),
 ('series_access_requests',array['id'])
 ) as tables(name, keys) loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function public.capture_audit_change(%s)',
 entry.name, (select string_agg(quote_literal(k),',') from unnest(entry.keys) k));
 end loop;
end;
$$;

-- Called only by the Edge Function service role. Never accepts email body/tokens.
create function public.audit_request_email(request_id uuid, outcome text, attempt_id uuid, provider_status integer default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if outcome not in ('attempted','accepted','failed') then raise exception 'Invalid email outcome'; end if;
 if not exists(select 1 from public.series_access_requests where id=request_id) then raise exception 'Request not found'; end if;
 insert into public.audit_log(database_role,action,entity_table,entity_key,metadata)
 values(coalesce(nullif(current_setting('role',true),'none'),session_user),'email.'||outcome,'series_access_requests',jsonb_build_object('id',request_id),
 jsonb_strip_nulls(jsonb_build_object('attempt_id',attempt_id,'provider_status',provider_status)));
end;
$$;
revoke all on function public.audit_request_email(uuid,text,uuid,integer) from public, anon, authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
   revoke all on public.audit_log from service_role;
   revoke all on sequence public.audit_log_id_seq from service_role;
   grant execute on function public.audit_request_email(uuid,text,uuid,integer) to service_role;
 end if;
end; $$;
