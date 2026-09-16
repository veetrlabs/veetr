import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initializeRoutes} from './routes';
let App: typeof import('./main').default;
function SiteApp(){
 const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
 useEffect(()=>{
  if(!('serviceWorker' in navigator)||!import.meta.env.PROD)return;
  let active=true;
  navigator.serviceWorker.register('/veetr-app-sw.js').then(reg=>{
   if(active&&reg.waiting)setWaiting(reg.waiting);
   reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(active&&worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(worker);});});
  }).catch(()=>{/* Online use remains available when offline caching is unsupported. */});
  return()=>{active=false;};
 },[]);
 return <App updateAvailable={Boolean(waiting)} updateServiceWorker={async()=>{
  if(!waiting)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});
  waiting.postMessage({type:'SKIP_WAITING'});
 }}/>;
}
async function start(){
 await initializeRoutes();
 App=(await import('./main')).default;
 createRoot(document.getElementById('root')!).render(<SiteApp/>);
}
void start();
