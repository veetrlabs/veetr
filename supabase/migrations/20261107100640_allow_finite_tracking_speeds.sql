-- Preserve finite nonnegative speeds, including travel outside normal boat speeds.
-- PostgreSQL orders NaN above infinity, so this also excludes NaN and both infinities.
alter table public.tracking_points
  drop constraint tracking_points_sog_mps_check,
  add constraint tracking_points_sog_mps_check
    check (sog_mps >= 0 and sog_mps < 'Infinity'::double precision);
alter table public.race_phone_points
  drop constraint race_phone_points_sog_mps_check,
  add constraint race_phone_points_sog_mps_check
    check (sog_mps >= 0 and sog_mps < 'Infinity'::double precision);
