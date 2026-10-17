-- The Data API invokes this hook for administrative imports as well as users.
-- Keep the account check intact and permit the existing service role to call it.
grant execute on function public.check_account_access() to service_role;
