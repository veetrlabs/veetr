-- User-editable preference, never an authorization claim. No preference => English.
create function private.account_email_language(recipient text) returns text
language sql stable security definer set search_path='' as $$
 select coalesce((select case when to_jsonb(u)->'raw_user_meta_data'->>'preferred_language'='cs' then 'cs' else 'en' end
 from auth.users u where lower(u.email)=lower(btrim(recipient)) limit 1),'en');
$$;
revoke all on function private.account_email_language(text) from public,anon,authenticated;

-- Keep all existing invitation authorization and retry rules; enrich only the
-- server-prepared payload using the authorized recipient's account preference.
do $$ declare signature text; definition text; marker text; replacement text; begin
 foreach signature in array array['public.prepare_boat_invitation_email(uuid)','public.prepare_race_invitation_email(text,uuid)','public.prepare_series_invitation_email(text,uuid)'] loop
 select pg_get_functiondef(signature::regprocedure) into definition;
 if signature like '%boat_invitation%' then
  marker:='''email'',i.email';
  replacement:='''language'',private.account_email_language(i.email),''email'',i.email';
 else
  marker:='''email'',recipient';
  replacement:='''language'',private.account_email_language(recipient),''email'',recipient';
 end if;
 if strpos(definition,marker)=0 then raise exception 'Missing email field in %',signature; end if;
 execute replace(definition,marker,replacement);
 end loop;
end $$;
