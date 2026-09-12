export const integrated = typeof document !== "undefined" && Boolean(document.getElementById("veetr-racing"));
type Routes = {series:Record<string,string>;boats:Record<string,string>};
let routes:Routes={series:{},boats:{}};
export function entityId(kind:keyof Routes,value:string|null):string|null {
 if(!value)return null;
 return Object.entries(routes[kind]).find(([,slug])=>slug===value)?.[0] || value;
}
export async function initializeRoutes() {
 try {const cached=localStorage.getItem('veetr.public-routes');if(cached)routes=JSON.parse(cached);}catch{}
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
 if(url&&key)try {
  const response=await fetch(`${url}/rest/v1/rpc/public_entity_routes`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
  if(response.ok){routes=await response.json();try{localStorage.setItem('veetr.public-routes',JSON.stringify(routes));}catch{}}
 }catch{/* Cached public URLs remain usable offline. */}
 const params=new URLSearchParams(location.search);
 if(location.pathname==='/races/' && (params.has('public') || params.has('series'))){
  const id=entityId('series',params.get('public') || params.get('series'))!;
  if(routes.series[id])history.replaceState(null,'',appHref(`?public=${id}${params.has("event")?`&event=${encodeURIComponent(params.get("event")!)}`:""}`)+location.hash);
 }
 if(location.pathname==='/boats/' && params.has('boat')){
  const id=entityId('boats',params.get('boat'))!;
  if(routes.boats[id])history.replaceState(null,'',appHref(`?boat=${id}`)+location.hash);
 }
}
export function appHref(query:string):string {
 if(!integrated)return query;
 if(query==='/')return '/races/manage/';
 const params=new URLSearchParams(query.replace(/^\?/,''));
 if(params.has('boats'))return '/boats/';
 if(params.has('boat'))return `/boats/?boat=${encodeURIComponent(routes.boats[params.get('boat')!] || params.get('boat')!)}`;
 if(params.has('browse'))return '/races/';
 if(params.has('public'))return `/races/?series=${encodeURIComponent(routes.series[params.get('public')!] || params.get('public')!)}${params.has('event')?`&event=${encodeURIComponent(params.get('event')!)}`:''}`;
 return `/races/manage/${params.size?`?${params}`:''}`;
}
