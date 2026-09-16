-- Remove the developer-only scoring note from the sample series.
do $$
declare sample public.series;
begin
 select * into sample from public.series where id='298ec7a6-e68f-59ea-8bd0-54e5b6e56d2d' and description='Seed fixture: M1 scores 2, 8, 12, 13, 9. Raw 44, counted 31.';
 if found then
  perform set_config('request.jwt.claim.sub',sample.owner_id::text,true);
  perform public.save_series(jsonb_set(sample.document,'{description}','""'::jsonb),sample.revision,gen_random_uuid());
 end if;
end;
$$;
