# Production database deployment

See [Deployment architecture and operations](DEPLOYMENT.md) for how the database,
website, DNS, and email services fit together.

The `Deploy Veetr database` GitHub Actions workflow applies the SQL files in
`supabase/migrations` to **Veetr / Regatta**, project `xvqlsltglpgfjhdrhdyc`.
Its destination is fixed in the workflow. Mautic projects are outside its scope.

Configure this encrypted repository Actions secret directly in GitHub:

- `VEETR_SUPABASE_ACCESS_TOKEN`: a Supabase deployment access token.

The CLI uses the access token to create temporary database login credentials.

Do not commit credentials or paste them into issues, logs, or chat. Access tokens
inherit the owner's permissions; use a deployment identity restricted to Veetr
where possible. The project's public anon key is not a database password.

Pushes to `main` that change migrations or the deployment workflow run the race
and database tests, then apply pending migrations. The workflow can also be run
manually from Actions on `main`. Deployments are serialized and are not cancelled
halfway through by newer pushes. Supabase records the applied migration history;
the workflow does not reset the database or load seed data.

Pages builds independently on Git pushes, so schema changes must remain
compatible with the previous frontend until the new deployment is live. Use additive migrations
first and remove old fields only in a later release.

If a migration fails, inspect the Actions log and migration history before
retrying. Do not rewrite an already applied migration or reset production.

Reference: https://supabase.com/docs/guides/deployment/managing-environments

## Explicit Data API permissions

New tables must declare the minimum required role grants alongside their RLS
setup in the creation migration. Do not depend on Supabase's default grants:
these are being removed for existing projects on October 30, 2026, and may
already be absent on newer projects. This includes `service_role` access from
Edge Functions; bypassing RLS does not bypass table permissions.

Keep tables used only through guarded `SECURITY DEFINER` functions private and
grant execution on the intended RPCs. For an already deployed table, add a new
forward migration rather than rewriting applied migration history. The
`explicit_creation_request_grant` migration supplies server-side read access to
`series_access_requests` for both production and fresh database rebuilds.

## Race course maps

Apply `20261006081808_race_course_map.sql` before enabling the course editor.
It validates optional `document.courses` keyed by race ID, permits assigned
referees to edit that field without changing race configuration, and includes
only courses with a published or locked heat in the public standings response.
Race deletion removes its course. Existing documents without courses and older
clients remain compatible; no backfill is required.

Apply `20261006083733_referee_start_position.sql` before deploying the phone
start-line controls. It adds optional bearing-only geometry and live-fix metadata,
plus `update_race_start_position`, callable only by active assigned officials.
The RPC changes only end A (or the bearing origin), checks fresh GPS quality,
and compares the expected course to stop conflicting publishers. A null fix
freezes the current position. The existing public projection exposes the course
only for published or locked heats; no phone identity or GPS history is added.
