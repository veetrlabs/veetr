import {useEffect,useRef,useState} from 'react';
import {supabase} from './api';
import {TrackCache,parseTracks,type TrackMeta,type TrackPoint} from './trackCache';
import {replayRequests} from './replayRequests';
export function useHeatReplay(seriesId:string,eventId:string,heatId?:string) {
  const cache=useRef(new TrackCache());
  const [meta,setMeta]=useState<TrackMeta|null>(null);
  const metaRef=useRef<TrackMeta|null>(null);
  const [at,setAt]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(30);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[version,update]=useState(0);
  const [retry,setRetry]=useState(0);
  const request=useRef<ReturnType<typeof replayRequests>|null>(null);
  const cursor=useRef(at);cursor.current=at;
  useEffect(()=>{
    let alive=true,refreshing=false;
    cache.current=new TrackCache();metaRef.current=null;setMeta(null);setLoading(true);
    const args={p_series:seriesId,p_event:eventId,...(heatId?{p_heat:heatId}:{})};
    async function fetchTracks(extra:{p_from?:string;p_offset?:number;p_known_count?:number;p_known_version?:string}={}) {
      if(!supabase) throw new Error('Not configured');
      const {data,error}=await supabase.rpc('public_replay_tracks',{...args,...extra});
      if(error) throw error;
      return parseTracks(data);
    }
    const queue=replayRequests(async requested=>{
      const current=metaRef.current;if(!current||current.end===null) {if(alive)setLoading(false);return;}
      const target=requested||current.end;
      const needed=cache.current.needed(current,target);
      if(needed.every(c=>cache.current.has(c.start,c.version))) {if(alive)setLoading(false);return;}
      if(alive)setLoading(true);
      try {
        for(const chunk of needed) {
          if(cache.current.has(chunk.start,chunk.version))continue;
          let points:TrackPoint[]=[];
          const previous=cache.current.previous(chunk.start);
          let offset=0;
          while(alive) {
            const page=await fetchTracks({p_from:new Date(chunk.start).toISOString(),p_offset:offset,...(previous?{p_known_count:previous.points.length,p_known_version:previous.version}:{})});
            if(!alive)return;
            // A changing chunk must be retried from the beginning on the next refresh.
            if(page.chunks.find(c=>c.start===chunk.start)?.version!==chunk.version) {
              cache.current.sync(page);metaRef.current=page;setMeta(page);
              queue.request(cursor.current);return;
            }
            if(offset===0 && page.append && previous) points=[...previous.points];
            points.push(...page.points);offset+=page.points.length;
            if(!page.more)break;
          }
          if(!alive)return;
          if(metaRef.current?.chunks.find(c=>c.start===chunk.start)?.version!==chunk.version)return;
          cache.current.put(chunk.start,chunk.version,points);
        }
        if(alive){setError('');update(n=>n+1);}
      } catch {if(alive){setError('Replay is unavailable. Try again.');setPlaying(false);}}
      finally {if(alive)setLoading(false);}
    });
    request.current=queue;
    async function refresh() {
      if(refreshing||!alive)return;refreshing=true;
      try {
        const next=await fetchTracks();
        if(!alive)return;
        cache.current.sync(next);metaRef.current=next;setMeta(next);update(n=>n+1);setError('');
        queue.request(cursor.current);
      } catch {
        if(alive){cache.current=new TrackCache();metaRef.current=null;setMeta(null);update(n=>n+1);setError('Replay is unavailable. Try again.');setPlaying(false);setLoading(false);}
      } finally {refreshing=false;}
    }
    void refresh();
    const timer=setInterval(()=>{if(!document.hidden)void refresh();},10000);
    const visible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',visible);
    return ()=>{alive=false;clearInterval(timer);queue.dispose();document.removeEventListener('visibilitychange',visible);};
  },[seriesId,eventId,heatId,retry]);
  const bounds=meta?.start!=null?{start:meta.start,end:meta.end!}:null;
  const selected=bounds?Math.min(Math.max(at||bounds.end,bounds.start),bounds.end):0;
  useEffect(()=>{request.current?.request(selected);},[selected]);
  useEffect(()=>{
    if(!playing||loading||error||!bounds)return;
    if(!at||at>=bounds.end){setPlaying(false);setAt(0);return;}
    const timer=setTimeout(()=>setAt(n=>Math.min(bounds.end,n+speed*100)),100);
    return ()=>clearTimeout(timer);
  },[playing,loading,error,at,bounds?.end,speed]);
  // The cache is deliberately memory-only and dies with this mounted map.
  const ready=meta&&cache.current.needed(meta,selected).every(c=>cache.current.has(c.start,c.version));
  const positions=ready?cache.current.frame(selected):[];
  void version;
  return {heats:meta?.heats??[],bounds,following:at===0,at:selected,shownAt:selected,positions,playing,speed,loading,error,
    setSpeed,retry:()=>setRetry(n=>n+1),
    seek:(value:number)=>{setPlaying(false);setAt(bounds&&value>=bounds.end?0:value);},
    togglePlay:()=>{if(bounds&&(!at||at>=bounds.end))setAt(bounds.start);setPlaying(v=>!v);}};
}
