-- Download the same public sailing details shown on the website. Never expose
-- owner identity, invitations, memberships or private account boat copies.
create or replace function public.boat_download_profile(bid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object(
   'id',b.id,'name',b.name,'className',b.class_name,'sailNumber',b.sail_number,
   'lengthM',b.length_m,'weightKg',b.weight_kg,'updatedAt',b.updated_at
 )) || b.specifications || jsonb_build_object(
   'isOwner',coalesce(b.owner_id=auth.uid() and public.account_access_allowed(),false)
 ) from public.boats b where b.id=bid;
$$;
revoke all on function public.boat_download_profile(uuid) from public,anon,authenticated;
grant execute on function public.boat_download_profile(uuid) to anon,authenticated;
notify pgrst, 'reload schema';
