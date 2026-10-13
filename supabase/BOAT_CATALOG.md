# Boat catalog

Boat lookup is online-only. The mobile app requests up to 30 model matches, then
paged configurations, then the chosen configuration's specifications and polar.
Only the selected profile and polar are saved locally. Offline users see a short
explanation and can still use Custom boat and previously saved profiles.

## Source and publication

`import-boat-catalog` downloads `jieter/orc-data/ALL<year>.json` from a full Git
commit SHA. The default is the verified 2024 snapshot at
`c2ca870c6b22cc02c25afd5bac0f2d8297bf95de` (5,888 usable configurations, 38 countries;
four records without usable identity/dimensions are skipped). The repository's
2025 snapshot currently has only 34 Australian records and is rejected.

The source file is a Python literal despite its extension. A restricted parser
reads values without evaluating code. The converted VPP matrix already contains
knots; beat/run VMG values are converted using their wind angles. Owner names,
addresses and individual boat names are not imported. Sail references distinguish
configurations. Overall length must not be substituted for waterline length;
neither waterline length nor air draft is supplied by this export.

Each import stages batches of 100 rows. The final database function validates the
row count and atomically replaces the public catalog and source metadata. A failed
fetch, parse, validation or publication leaves the existing catalog intact. An
import with fewer than 1,000 rows, fewer than 10 countries, over 10% rejected rows,
or a published row count below 75% of the current catalog is rejected. Abandoned
staging rows are removed by later imports after one day. Source commit, year,
SHA-256 and import time are retained. Existing device profiles are never updated
by a catalog import.

Search access is read-only for anon/authenticated roles. Staging and publishing
are service-role-only. The Edge Function independently checks its service-role
credential; ordinary user tokens and anon keys cannot import. Credentials never
belong in the app or repository. No schedule is installed.

## Manual execution

Apply the Git migration `20261012194734_boat_catalog.sql` to the intended database
and deploy/serve the `import-boat-catalog` function. Keep the normal JWT verification
enabled. Export `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the operator's
shell without committing them, then run:

```sh
node tools/import-boat-catalog.mjs
# Explicit reviewed snapshot:
node tools/import-boat-catalog.mjs 2024 <full-git-commit-sha>
```

A successful response includes count, skipped count, country count and source
identity. Re-importing the same source is safe and does not duplicate entries.
Scheduling can later invoke this same authenticated endpoint; no client change is
needed. Before distributing the upstream dataset, retain its repository license
notice and resolve the upstream ORC data reuse terms separately from software MIT
licensing.

## Local verification

Use local Docker Supabase. Never reset an existing development database to test
this feature. Apply the migration through the local migration workflow; if that
instance has unrelated migration-history drift, apply the exact migration SQL
with local psql without repairing or deleting unrelated history.

```sh
supabase functions serve
supabase status -o json > /tmp/veetr-local-status.json
node tools/test-boat-catalog-local.mjs /tmp/veetr-local-status.json
node --test supabase/tests/boat-catalog*.test.mjs
npm test --prefix app -- --runInBand src/boats src/polar
npm run typecheck --prefix app
```

Run the manual import against that local instance before the integration script.
The local test rejects hosted URLs and checks lookup, punctuation, configuration
paging, polar detail, stale revisions, read-only access, admin-only imports and
preservation of the previous catalog after a rejected publication. The migration
test also checks that constraint failures roll back the whole publication.
