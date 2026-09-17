# Legacy local database upgrade

`legacy-boat-invitations.sql` upgrades the local database whose `202609130001`
migration is named `creation_access`. That database predates the current main
branch's tracking migrations, which reuse the same version for `boat_tracking`.
This script is **not a production migration** and is not part of a fresh setup.

The guarded transaction applies missing profile permissions, tracking/replay,
email retry limits, audit lifecycle, and boat invitations. Existing creation
access and audit tables are retained. Account, boat, series, and result counts
are checked before commit. The actual compatibility work is recorded under
`202609160000/local_legacy_tracking_upgrade`, followed by the invitation migration;
original migration history is preserved. It reloads the PostgREST schema cache.

Validated against the legacy schema with PGlite and applied to `supabase_db_veetr`.
Before application, `public`, `auth`, and `supabase_migrations` were backed up in
that container to `/tmp/veetr-before-invitations.dump` using `pg_dump -Fc`.

Do not run normal migration repair to pretend the legacy versions were main's
migrations. Future local upgrades must account for this retained history; a fresh
database uses the normal `supabase/migrations` directory instead.
