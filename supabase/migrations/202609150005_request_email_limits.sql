-- Claims are consumed before contacting the provider, including failed sends.
alter table public.series_access_requests
  add column email_attempt_count integer not null default 0,
  add column email_first_attempt_at timestamptz,
  add column email_next_attempt_at timestamptz;

create function public.claim_request_email(request_id uuid, requester_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  update public.series_access_requests
  set email_attempt_count = email_attempt_count + 1,
      email_first_attempt_at = coalesce(email_first_attempt_at, clock_timestamp()),
      email_next_attempt_at = clock_timestamp() + interval '5 minutes'
  where id = request_id and user_id = requester_id
    and status = 'pending' and email_sent_at is null
    and email_attempt_count < 5
    and (email_next_attempt_at is null or email_next_attempt_at <= clock_timestamp())
    -- Stay inside the provider's 24-hour idempotency retention window.
    and (email_first_attempt_at is null or email_first_attempt_at > clock_timestamp() - interval '23 hours')
  returning id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_request_email(uuid,uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_request_email(uuid,uuid) to service_role;
  end if;
end $$;
