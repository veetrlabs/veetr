# Production database deployment

The `Deploy Veetr database` GitHub Actions workflow applies the SQL files in
`supabase/migrations` to **Veetr / Regatta**, project `xvqlsltglpgfjhdrhdyc`.
Its destination is fixed in the workflow. Mautic projects are outside its scope.

Configure these encrypted repository Actions secrets directly in GitHub:

- `VEETR_SUPABASE_ACCESS_TOKEN`: a Supabase deployment access token.
- `VEETR_SUPABASE_DB_PASSWORD`: the database password for Regatta only.

Do not commit credentials or paste them into issues, logs, or chat. Access tokens
inherit the owner's permissions; use a deployment identity restricted to Veetr
where possible. The project's public anon key is not a database password.

Pushes to `main` that change migrations or the deployment workflow run the race
and database tests, then apply pending migrations. The workflow can also be run
manually from Actions on `main`. Deployments are serialized and are not cancelled
halfway through by newer pushes. Supabase records the applied migration history;
the workflow does not reset the database or load seed data.

For the initial release, wait for this workflow to succeed before switching the
website's custom domain to Cloudflare Pages. Pages currently builds independently
on Git pushes, so subsequent schema changes must remain compatible with the
previous frontend until the new deployment is live. Use additive migrations
first and remove old fields only in a later release.

If a migration fails, inspect the Actions log and migration history before
retrying. Do not rewrite an already applied migration or reset production.

Reference: https://supabase.com/docs/guides/deployment/managing-environments
