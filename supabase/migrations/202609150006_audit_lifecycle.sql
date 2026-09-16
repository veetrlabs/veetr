-- Live references may be cleared; immutable audit snapshots retain the reviewer.
alter table public.series_access_requests
  drop constraint series_access_requests_reviewed_by_fkey,
  add constraint series_access_requests_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) on delete set null;

-- Record consent/session lifecycle without duplicating high-volume GPS samples.
create trigger audit_change
after insert or update or delete on public.tracking_sessions
for each row execute function public.capture_audit_change('id');
