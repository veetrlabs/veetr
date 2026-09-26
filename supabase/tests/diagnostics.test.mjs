import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('diagnostics accepts only bounded technical reports, hides them and expires them', async t => {
 const db = new PGlite(); t.after(() => db.close());
 await db.exec('create role anon; create role authenticated; create role service_role;');
 await db.exec(await readFile(new URL('../migrations/202609240001_optional_diagnostics.sql', import.meta.url), 'utf8'));
 const report = { id: randomUUID(), installationId: randomUUID(), occurredAt: new Date().toISOString(), consent: 'manual', event: 'manual', appVersion: '0.0.28', build: '12', platform: 'android', osVersion: '34', model: 'OnePlus', state: 'active', foregroundPermission: 'granted', backgroundPermission: 'granted', tracking: 'recording', fixAgeSeconds: 90, uploadAgeSeconds: 120, accuracyM: null, pendingCount: 12, recoveryCount: 1, errorCode: 'gps' };
 const submit = reports => db.query('select public.submit_diagnostics($1::jsonb) n', [JSON.stringify(reports)]);
 await db.exec('set role anon');
 assert.equal((await submit([report])).rows[0].n, 1);
 await submit([report]); // Retry is idempotent.
 await assert.rejects(db.query('select * from public.diagnostic_reports'), /permission denied/);
 await assert.rejects(db.query('delete from public.diagnostic_reports'), /permission denied/);
 await assert.rejects(db.query('select public.purge_diagnostics()'), /permission denied/);
 await assert.rejects(submit([{ ...report, latitude: 49 }]), /Unexpected/);
 await assert.rejects(submit([{ ...report, errorCode: 'raw secret error' }]), /Invalid/);
 await assert.rejects(submit([{ ...report, consent: null }]), /Invalid/);
 await assert.rejects(submit([{ ...report, pendingCount: -1 }]), /Invalid/);
 await assert.rejects(submit(Array.from({ length: 21 }, () => report)), /too large/);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from public.diagnostic_reports')).rows[0].n, 1);
 await db.exec("update public.diagnostic_reports set received_at=now()-interval '31 days'");
 await db.exec('select public.purge_diagnostics()');
 assert.equal((await db.query('select count(*)::int n from public.diagnostic_reports')).rows[0].n, 0);
});
