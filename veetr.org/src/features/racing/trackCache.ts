import {parseTrackingPositions, type TrackingPosition} from './tracking';
export const CHUNK_MS = 300000;
export type TrackPoint = Omit<TrackingPosition,'trail'|'trailSegments'> & {sessionId:string};
export type TrackMeta = {start:number|null;end:number|null;heats:{id:string;name:string;start:string|null;end:string|null}[];chunks:{start:number;count:number;version:string}[]};
export function parseTracks(data: unknown): TrackMeta & {points:TrackPoint[];more:boolean;append:boolean} {
  const v = data as any;
  if (!v || !Array.isArray(v.chunks) || !Array.isArray(v.heats) || !Array.isArray(v.points)) throw new Error('Invalid tracks');
  const start=v.start===null?null:Date.parse(v.start),end=v.end===null?null:Date.parse(v.end);
  if ((start===null)!==(end===null) || (start!==null && (!Number.isFinite(start)||!Number.isFinite(end)||end!<start))) throw new Error('Invalid bounds');
  for(const c of v.chunks) if(!Number.isFinite(c.start)||!Number.isInteger(c.count)||c.count<0||typeof c.version!=='string') throw new Error('Invalid chunks');
  parseTrackingPositions(v.points.map((p:TrackPoint)=>({...p,trail:[]})));
  if(v.points.some((p:TrackPoint)=>typeof p.sessionId!=='string')) throw new Error('Invalid session');
  return {...v,start,end};
}
export class TrackCache {
  private chunks = new Map<number,{version:string;points:TrackPoint[]}>();
  sync(meta:TrackMeta) {
    for(const [key,value] of this.chunks) if(!meta.chunks.some(c=>c.start===key)) this.chunks.delete(key);
  }
  previous(start:number) {return this.chunks.get(start);}
  has(start:number,version:string) {return this.chunks.get(start)?.version===version;}
  put(start:number,version:string,points:TrackPoint[]) {
    this.chunks.delete(start);this.chunks.set(start,{version,points});
  }
  needed(meta:TrackMeta,at:number) {
    return meta.chunks.filter(c=>c.start<=at+60000);
  }
  frame(at:number):TrackingPosition[] {
    const boats = new Map<string,TrackPoint[]>();
    for(const chunk of this.chunks.values()) for(const p of chunk.points) {
      if(Date.parse(p.recordedAt)>at+60000) continue;
      const rows=boats.get(p.boatId)??[];rows.push(p);boats.set(p.boatId,rows);
    }
    const result:TrackingPosition[]=[];
    for(const rows of boats.values()) {
      rows.sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt)||a.sessionId.localeCompare(b.sessionId));
      const past=rows.filter(p=>Date.parse(p.recordedAt)<=at);
      const last=past.at(-1);if(!last) continue;
      const future=rows.filter(p=>p.sessionId===last.sessionId&&Date.parse(p.recordedAt)>at);
      const sessions = new Map<string,[number,number][]>();
      for (const p of past) {
        const trail = sessions.get(p.sessionId) ?? [];
        trail.push([p.latitude,p.longitude]);sessions.set(p.sessionId,trail);
      }
      result.push({...last,trail:sessions.get(last.sessionId)!,trailSegments:[...sessions.values()],
        nextFix:future[0]??null,futureFixes:future});
    }
    return result;
  }
}
