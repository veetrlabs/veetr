import {test} from 'node:test';
import assert from 'node:assert/strict';

test('public, editable and legacy links use one canonical series route and preserve heat navigation', async () => {
 const previous = {document: globalThis.document, location: globalThis.location, history: globalThis.history};
 try {
  Object.assign(globalThis, {document: {getElementById: () => ({})}, location: {pathname:"/races/"}});
  const {appHref, initializeRoutes} = await import('./routes');
  const route = '/races/?series=series-id&event=event-id&heat=heat-id';
  assert.equal(appHref('?public=series-id&event=event-id&heat=heat-id'),route);
  assert.equal(appHref('?series=series-id&event=event-id&heat=heat-id'),route);
  assert.equal(appHref('?series=series-id&new-race='),'/races/?series=series-id&new-race=');
  assert.equal(appHref('?series=series-id&event=event-id&new-heat='),'/races/?series=series-id&event=event-id&new-heat=');
  assert.equal(appHref('?series=series-id&event=event-id&heat=heat-id&edit-course='),route+'&edit-course=');
  assert.equal(appHref('?public=series-id&event=event-id&edit-race='), '/races/?series=series-id&event=event-id&edit-race=');
  assert.equal(appHref('?series=series-id&edit-race=&edit-tab=team'), '/races/?series=series-id&edit-race=&edit-tab=team');
  assert.equal(appHref('?account&edit-user=user-id'),'/account/?edit-user=user-id');
  assert.equal(appHref('?account'),'/account/');
  assert.equal(appHref('?boats'),'/races/');
  assert.equal(appHref('?boat=boat-id'),'/boats/boat-id/');
  assert.equal(appHref('/'),'/races/');
  assert.equal(appHref('?browse'),'/races/');
  let replaced = '';
  Object.assign(globalThis, {location: {pathname:'/races/manage/',search:'?series=series-id&event=event-id&heat=heat-id',hash:''},history:{replaceState: (_a: unknown,_b: string,url: string) => {replaced=url;}}});
  await initializeRoutes();
  assert.equal(replaced,route);
  let destination = '';
  Object.assign(globalThis, {location: {pathname:'/boats/', search:'', replace: (url:string) => {destination=url;}}});
  await initializeRoutes();
  assert.equal(destination, '/races/');
  Object.assign(globalThis, {location: {pathname:'/cs/races/',search:'?series=series-id&event=event-id',hash:'#tracking'}, history:{replaceState: (_a: unknown,_b: string,url: string) => {replaced=url;}}});
  assert.equal(appHref('?series=series-id&event=event-id&heat=heat-id'), '/cs'+route);
  assert.equal(appHref('?account'), '/cs/account/');
  assert.equal(appHref('?boat=boat-id'), '/cs/boats/boat-id/');
  assert.equal(appHref('?new-series'), '/cs/races/new/');
  await initializeRoutes();
  assert.equal(replaced, '/cs/races/?series=series-id&event=event-id#tracking');
  const {boatRouteValue} = await import('./routes');
  assert.equal(boatRouteValue('/cs/boats/boat-name/',''), 'boat-name');
  Object.assign(globalThis, {location: {pathname:'/cs/boats/', search:'', replace: (url:string) => {destination=url;}}});
  await initializeRoutes();
  assert.equal(destination, '/cs/races/');
 } finally {Object.assign(globalThis,previous);}
});
