import type { Trip } from '../tracking/trip';
import { DIAGNOSTIC_SCHEMA, flushTripDiagnostics, tripDiagnosticBridge, type DiagnosticBridge } from './tripRecording';

/** Stream the potentially large sensor history; never load the whole log into JS memory. */
export async function writeTripExport(trip: Trip, write: (chunk: string) => void, bridge: DiagnosticBridge | null = tripDiagnosticBridge()) {
  await flushTripDiagnostics();
  const snapshot = await bridge?.snapshot(trip.session.id);
  write('{"session":'); write(JSON.stringify(trip.session));
  write(',"archived":'); write(JSON.stringify(trip.archived ?? false));
  write(',"points":[');
  for(let i=0;i<trip.points.length;i++) { if(i) write(','); write(JSON.stringify(trip.points[i])); }
  write('],"diagnostics":');
  if (!snapshot || !snapshot.through) {
    write(JSON.stringify({schemaVersion:DIAGNOSTIC_SCHEMA, available:false, reason:bridge ? 'not_recorded_or_deleted' : 'native_recorder_unavailable'}));
  } else {
    write(JSON.stringify({schemaVersion:DIAGNOSTIC_SCHEMA, available:true, ...snapshot}).slice(0,-1));
    write(',"entries":[');
    let after=0, first=true;
    while(after<snapshot.through) {
      const rows = await bridge!.read(trip.session.id,after,snapshot.through);
      if(!rows.length) throw new Error('Diagnostic recording changed during export. Please retry.');
      for(const row of rows) {
        if(row.seq<=after || row.seq>snapshot.through) throw new Error('Invalid diagnostic export sequence.');
        if(!first) write(','); write(row.body); first=false; after=row.seq;
      }
    }
    write(']}');
  }
  write('}');
}
