export const integrated = typeof document !== "undefined" && Boolean(document.getElementById("veetr-racing"));
type Routes = {series:Record<string,string>;boats:Record<string,string>};
let routes:Routes={series:{},boats:{}};
export function boatRouteValue(pathname:string, search:string):string|null {
 const match=pathname.match(/^\/boats\/([^/]+)\/?$/);
 if(match)try{return decodeURIComponent(match[1]);}catch{return match[1];}
 return new URLSearchParams(search).get('boat');
}
export function entityId(kind:keyof Routes,value:string|null):string|null {
 if(!value)return null;
 return Object.entries(routes[kind]).find(([,slug])=>slug===value)?.[0] || value;
}
export async function initializeRoutes() {
 // The all-boats directory is retired; boat profile URLs still use this shell.
 if ((location.pathname === '/boats/' || location.pathname === '/boats') && !new URLSearchParams(location.search).has('boat')) {
  location.replace('/races/');
  return;
 }
 try {const cached=localStorage.getItem('veetr.public-routes');if(cached)routes=JSON.parse(cached);}catch{}
 const url=import.meta.env?.VITE_SUPABASE_URL,key=import.meta.env?.VITE_SUPABASE_ANON_KEY;
 if(url&&key)try {
  const response=await fetch(`${url}/rest/v1/rpc/public_entity_routes`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
  if(response.ok){routes=await response.json();try{localStorage.setItem('veetr.public-routes',JSON.stringify(routes));}catch{}}
 }catch{/* Cached public URLs remain usable offline. */}
 const params=new URLSearchParams(location.search);
 if(location.pathname==='/races/manage/' && !params.has('public') && !params.has('series')) history.replaceState(null,'','/races/'+location.search+location.hash);
 if((location.pathname==='/races/' || location.pathname==='/races/manage/') && (params.has('public') || params.has('series'))){
  const id=entityId('series',params.get('public') || params.get('series'))!;
  history.replaceState(null,'',appHref(`?public=${id}${["event","heat","new-race","new-heat"].filter(k=>params.has(k)).map(k=>`&${k}=${encodeURIComponent(params.get(k)!)}`).join("")}`)+location.hash);
 }
 if(location.pathname==='/boats/' && params.has('boat')){
  const id=entityId('boats',params.get('boat'))!;
  history.replaceState(null,'',appHref(`?boat=${encodeURIComponent(id)}`)+location.hash);
 }
}
export function appHref(query:string):string {
 if(!integrated)return query;
 if(query==='/')return '/races/';
 const params=new URLSearchParams(query.replace(/^\?/,''));
 if(params.has('boats'))return '/races/';
 if(params.has('account'))return '/account/' + (params.has('edit-user') ? `?edit-user=${encodeURIComponent(params.get('edit-user')!)}` : '');
 if(params.has('boat'))return `/boats/${encodeURIComponent(routes.boats[params.get('boat')!] || params.get('boat')!)}/`;
 if(params.has('new-series'))return '/races/new/';
 if(params.has('browse'))return '/races/';
 if(params.has('series')) { params.set('public',params.get('series')!); params.delete('series'); }
 if(params.has('public'))return `/races/?series=${encodeURIComponent(routes.series[params.get('public')!] || params.get('public')!)}${['event','heat','new-race','new-heat'].filter(k=>params.has(k)).map(k=>`&${k}=${encodeURIComponent(params.get(k)!)}`).join('')}`;
 return `/races/${params.size?`?${params}`:''}`;
}
