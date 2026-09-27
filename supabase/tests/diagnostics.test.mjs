import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('diagnostics accepts only bounded technical reports, hides them and expires them', async t => {
 const db = new PGlite(); t.after(() => db.close());
 await db.exec('create role anon; create role authenticated; create role service_role;');
 await db.exec(await readFile(new URL('../migrations/202609240001_optional_diagnostics.sql', import.meta.url), 'utf8'));
 await db.exec(await readFile(new URL('../migrations/20260925122516_tracking_diagnostic_pipeline.sql', import.meta.url), 'utf8'));
 await db.exec(await readFile(new URL('../migrations/20260927111211_bluetooth_diagnostics.sql', import.meta.url), 'utf8'));
 await db.exec(await readFile(new URL('../migrations/20260927153419_bluetooth_reconnect_context.sql', import.meta.url), 'utf8'));
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
 const native = { enabled: true, serviceRunning: true, screenInteractive: false, powerSave: false, deviceIdle: false, batteryExempt: false, gpsProviderEnabled: true, networkProviderEnabled: true, windowAgeSeconds: 120, lastFixDelayMs: 3, pendingJobs: 1, quotaBlockedJobs: 1 };
 for (const stage of ['registered','requestAccepted','requestFailed','broadcast','fix','jobScheduled','jobStarted','taskDispatched','taskFinished','serviceStarted','serviceStopped']) {
  native[`${stage}Count`]=5; native[`${stage}ScreenOffCount`]=3; native[`${stage}AgeSeconds`]=10;
 }
 const extended = { ...report, id: randomUUID(), event: 'app_state', state: 'background', native,
  pipeline: { foregroundCallbackAgeSeconds: 45, backgroundCallbackAgeSeconds: null, taskCallbackAgeSeconds: null, batchSize: 1, deliveryDelayMs: 5, rejectedFixes: 0, backgroundRequested: true, precisePermission: true, storageAvailable: true } };
 await db.exec('set role anon');
 assert.equal((await submit([extended, report])).rows[0].n, 2);
 await assert.rejects(submit([{...extended,native:{...native, latitude:49}}]),/Unexpected/);
 await assert.rejects(submit([{...extended,native:{...native,fixCount:'secret'}}]),/Invalid/);
 await assert.rejects(submit([{...extended,pipeline:{...extended.pipeline,rawError:'secret'}}]),/Unexpected/);
 await assert.rejects(db.query('select * from public.diagnostic_reports'),/permission denied/);
 const ble = { stage: 'connect', outcome: 'error', adapterState: 'PoweredOn', errorCode: 2, iosErrorCode: null, androidErrorCode: null, attErrorCode: null, ageSeconds: 3 };
 assert.equal((await submit([{...extended,id:randomUUID(),ble:[ble]}])).rows[0].n,1);
 for (const invalid of [{...ble,deviceId:'secret'}, {...ble,errorCode:'secret'}, {...ble,stage:null}, {...ble,stage:'raw error'}, {...ble,ageSeconds:21601}, {...ble,iosErrorCode:1.5}]) {
  await assert.rejects(submit([{...extended,ble:[invalid]}]), /Invalid|Unexpected/);
 }
 await assert.rejects(submit([{...extended,ble:Array(21).fill(ble)}]), /too large/);
 const context = {...ble,appState:'background',connectionSeconds:120,sensorAgeSeconds:4,rssi:-82,rssiAgeSeconds:12,firmwareVersion:'v0.0.28',retryAttempt:2,method:'direct',attemptSeconds:15};
 assert.equal((await submit([{...extended,id:randomUUID(),ble:Array(20).fill(context)}])).rows[0].n,1);
 for (const invalid of [{...context,rssi:-128},{...context,firmwareVersion:'private device name'},{...context,method:'secret'},{...context,appState:null},{...context,deviceId:'secret'}]) await assert.rejects(submit([{...extended,ble:[invalid]}]), /Invalid|Unexpected/);

 await db.exec('reset role');
 await db.exec("update public.diagnostic_reports set received_at=now()-interval '31 days'");
 await db.exec('select public.purge_diagnostics()');
 assert.equal((await db.query('select count(*)::int n from public.diagnostic_reports')).rows[0].n, 0);
});
