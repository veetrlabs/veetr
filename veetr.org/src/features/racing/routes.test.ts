import {test} from 'node:test';
import assert from 'node:assert/strict';

test('public, editable and legacy links use one canonical series route and preserve heat navigation', async () => {
 const previous = {document: globalThis.document, location: globalThis.location, history: globalThis.history};
 try {
  Object.assign(globalThis, {document: {getElementById: () => ({})}});
  const {appHref, initializeRoutes} = await import('./routes');
  const route = '/races/?series=series-id&event=event-id&heat=heat-id';
  assert.equal(appHref('?public=series-id&event=event-id&heat=heat-id'),route);
  assert.equal(appHref('?series=series-id&event=event-id&heat=heat-id'),route);
  assert.equal(appHref('/'),'/races/');
  assert.equal(appHref('?browse'),'/races/');
  let replaced = '';
  Object.assign(globalThis, {location: {pathname:'/races/manage/',search:'?series=series-id&event=event-id&heat=heat-id',hash:''},history:{replaceState: (_a: unknown,_b: string,url: string) => {replaced=url;}}});
  await initializeRoutes();
  assert.equal(replaced,route);
 } finally {Object.assign(globalThis,previous);}
});
