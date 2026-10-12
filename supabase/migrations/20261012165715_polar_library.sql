-- Personal, opt-in polar library. Private boat identifiers are not public registry membership.
create table public.polar_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  polar_id uuid not null,
  boat_id text not null check(length(boat_id) between 1 and 120),
  boat_document jsonb not null default '{}' check(jsonb_typeof(boat_document)='object' and octet_length(boat_document::text)<=10000),
  document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=2000000),
  created_at timestamptz not null default now(),
  primary key(user_id,polar_id)
);
alter table public.polar_library enable row level security;
grant select,insert,delete on public.polar_library to authenticated;
create policy polar_library_read on public.polar_library for select to authenticated
  using(user_id=(select auth.uid()) and (select public.account_access_allowed()));
create policy polar_library_add on public.polar_library for insert to authenticated
  with check(user_id=(select auth.uid()) and (select public.account_access_allowed()));
create policy polar_library_delete on public.polar_library for delete to authenticated
  using(user_id=(select auth.uid()) and (select public.account_access_allowed()));
-- Snapshots are immutable. Rebuilding a learned polar creates a new version/id.
