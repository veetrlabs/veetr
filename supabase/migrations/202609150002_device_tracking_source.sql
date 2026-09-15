-- Existing sessions and publication/ownership checks are unchanged.
alter table public.tracking_points drop constraint tracking_points_source_check;
alter table public.tracking_points add constraint tracking_points_source_check check(source in ('phone','veetr'));

alter table public.tracking_points alter column accuracy_m drop not null;
alter table public.tracking_points add constraint phone_tracking_accuracy_required check(source <> 'phone' or accuracy_m is not null);
