/** Display-only route quality. Original samples, speeds and distance totals stay intact. */
type Fix = { latitude: number; longitude: number; recordedAt: string; accuracyM?: number | null; sessionId?: string };
export type RouteSection<T> = { points: T[]; estimated: boolean };
function metres(a: Fix, b: Fix) {
  const r = Math.PI / 180;
  const h = Math.sin((b.latitude-a.latitude)*r/2)**2 + Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin((b.longitude-a.longitude)*r/2)**2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1,h)));
}
/** Reject only isolated excursions with both a rapid departure and return.
 * A sustained turn, high speed, or sparse context is not enough to reject a fix.
 * Accuracy is an uncertainty estimate, never a guarantee of positional correctness.
 */
export function routeGeometry<T extends Fix>(input: readonly T[]): RouteSection<T>[] {
  const output: RouteSection<T>[] = [];
  let run: T[] = [];
  const finish = () => {
    if (!run.length) return;
    const suspect = run.map(p => p.accuracyM != null && p.accuracyM > 30);
    for (let i=2; i<run.length-2; i++) {
      const [before,a,p,b,after] = run.slice(i-2,i+3);
      const dt = (x:T,y:T) => (Date.parse(y.recordedAt)-Date.parse(x.recordedAt))/1000;
      const times = [dt(before,a),dt(a,p),dt(p,b),dt(b,after)];
      if (times.some(t => t <= 0 || t > 10) || suspect[i-1] || suspect[i+1]) continue;
      const baseline = Math.max(metres(before,a)/times[0],metres(b,after)/times[3],metres(a,b)/(times[1]+times[2]));
      const excess = metres(a,p)+metres(p,b)-metres(a,b);
      if (excess > Math.max(40, 3*(p.accuracyM ?? 10)) &&
          metres(a,p)/times[1] > baseline*3+5 && metres(p,b)/times[2] > baseline*3+5) suspect[i]=true;
    }
    // Keep endpoints visible, but mark uncertain endpoints/bridges as estimates.
    const kept = run.map((point,index)=>({point,index})).filter(({index})=>!suspect[index] || index===0 || index===run.length-1);
    let section: RouteSection<T> | undefined;
    for (let i=1; i<kept.length; i++) {
      const a=kept[i-1],b=kept[i];
      const estimated = suspect[a.index] || suspect[b.index] || b.index>a.index+1 || Date.parse(b.point.recordedAt)-Date.parse(a.point.recordedAt)>60000;
      if (!section || section.estimated!==estimated) { section={points:[a.point],estimated};output.push(section); }
      section.points.push(b.point);
    }
    if (kept.length===1) output.push({points:[kept[0].point],estimated:suspect[0]});
    run=[];
  };
  for (const p of input) {
    if (!Number.isFinite(p.latitude) || Math.abs(p.latitude)>90 || !Number.isFinite(p.longitude) || Math.abs(p.longitude)>180 || !Number.isFinite(Date.parse(p.recordedAt))) { finish(); continue; }
    const previous=run.at(-1);
    if (previous && (previous.sessionId!==p.sessionId || Date.parse(p.recordedAt)<=Date.parse(previous.recordedAt))) finish();
    run.push(p);
  }
  finish();
  return output;
}
