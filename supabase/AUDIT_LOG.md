# Audit log

Inspect `public.audit_log` in Supabase Table Editor or SQL Editor. There is no application audit page. Apply `202609150004_audit_log.sql` after the creation-request migrations, before deploying the updated email function. The same audit migration works with both local and prepared production histories.

## Recorded evidence

- Inserts, updates and deletes on series, boats, memberships, categories, registrations, heat/result projections, creation permissions and permission requests.
- Full before/after series documents preserve event/heat names, results, publishing changes, imports and restored data. These are stored as document changes; the database cannot infer whether an identical change came from an import, restoration or manual edit.
- `series_changes` entries preserve mutation IDs and revisions. Join by `transaction_id` to find the series snapshot and related row changes from that save. Projection rebuilds can produce delete/insert pairs, which do not necessarily mean a user deleted/recreated the entity. Timestamp-only updates are omitted.
- Email attempts, provider acceptance and failures carry a shared attempt ID, request ID and HTTP status. Provider acceptance is not proof of inbox delivery. A crash can leave an attempt without an outcome; retries use the request's existing Resend idempotency key. No email body, key, token or HTTP headers are stored in these events.

`actor_id` and `actor_email` identify the authenticated caller at the time of a database change. They are snapshots with no foreign keys, so deletion does not erase them. Service email events have no human actor; follow `entity_key.id` to the permission request. Dashboard/SQL changes without a user JWT have a null actor and database role; identifying an individual Supabase operator requires Supabase's own platform logs.

Audit rows are written in the same transaction as each data change. Rolled-back changes and rejected writes leave no audit rows. Failed authentication, denied operations, rejected sync conflicts, read access, and offline changes not yet synchronized are **not** covered by these triggers; investigate those through the appropriate authentication/operational logs. This is not a record of every browser interaction.

## Access and storage

RLS is enabled with no client policies. Anonymous users, signed-in users (including app admins), and the service role cannot read, insert, update, delete or truncate the audit table. Only the service role can call the narrowly scoped email-audit function. Database owners can inspect and administer the log, and can ultimately alter its protections; this is not tamper-proof against database administrators.

Existing data is not backfilled. Snapshots retain business data, including names and request notes, after deletion. There is no automatic expiry. Review storage/retention as usage grows; complete series snapshots consume space on each successful save. Auth credentials are outside the audited tables.

## Investigation examples

```sql
-- Latest activity
select id, occurred_at, actor_email, database_role, action, entity_table,
       entity_key, series_id, transaction_id
from public.audit_log order by id desc limit 100;

-- All evidence from one save (replace with the transaction ID from a row)
select * from public.audit_log
where transaction_id = 12345 order by id;

-- Locate a client mutation ID, then inspect that transaction
select * from public.audit_log
where entity_table = 'series_changes'
  and entity_key->>'mutation_id' = 'YOUR-MUTATION-UUID';

-- Email outcomes, including failed attempts
select occurred_at, action, entity_key, metadata
from public.audit_log where action like 'email.%' order by id desc;
```

Run `node --test supabase/tests/*.test.mjs`. Tests cover real migrations/RPCs, before/after values, actor attribution, mutation correlation, rollback, idempotent saves, permission restrictions, deletion survival, and email outcomes. Email provider/Auth HTTP responses are simulated; no external email is sent by this suite.
