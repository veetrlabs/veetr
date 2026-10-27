import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/race-visibility-worker.js';
const sid = '11111111-1111-4111-8111-111111111111';
const env = {VITE_SUPABASE_URL:'https://example.test', VITE_SUPABASE_ANON_KEY:'public-test-key',
  ASSETS:{fetch:async () => new Response('<html>Application shell</html>')}};

test('page HTTP status follows public visibility for series, races, and heats', async t => {
  let visible = true;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(url.endsWith('/public_series_by_route'));
    return visible ? Response.json({status:'active',visibility:'public',races:[{id:'heat',eventId:'event'}]}) : Response.json({code:'PT404'}, {status:404});
  });
  const get = (query, method='GET') => worker.fetch(new Request(`https://veetr.org/races/?${query}`, {method}), env);
  assert.equal((await get(`series=${sid}&event=event&heat=heat`)).status, 200);
  assert.equal((await get('series=series-slug')).status, 200);
  assert.equal((await get(`series=${sid}&heat=unknown`)).status, 404);
  assert.equal((await get(`series=${sid}&event=unknown`)).status, 404);
  visible = false;
  for (const query of [`series=${sid}`, 'series=series-slug', `public=${sid}&event=event&heat=heat`]) {
    const response = await get(query);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.match(await response.text(), /Application shell/);
  }
  const head = await get(`series=${sid}`, 'HEAD');
  assert.equal(head.status, 404);
  assert.equal(await head.text(), '');
  assert.equal((await worker.fetch(new Request(`https://veetr.org/cs/races/?series=${sid}`),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://veetr.org/races/'),env)).status,200);
});

test('unlisted links return 200 with noindex and resolve only the supplied link', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/public_series_by_route'));
    assert.deepEqual(JSON.parse(options.body), {series_route:'unlisted-series'});
    return Response.json({status:'active',visibility:'unlisted',races:[{id:'heat',eventId:'event'}]});
  });
  const response=await worker.fetch(new Request('https://veetr.org/races/?series=unlisted-series&event=event'),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-robots-tag'),'noindex');
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('upstream failures return 503 rather than a false 404', async t => {
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('offline');});
  assert.equal((await worker.fetch(new Request(`https://veetr.org/races/?series=${sid}`),env)).status,503);
});
