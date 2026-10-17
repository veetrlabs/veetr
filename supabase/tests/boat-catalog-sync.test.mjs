import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {catalogEnvironment, syncBoatCatalog} from '../../tools/sync-boat-catalog.mjs';
const revision='a'.repeat(40), old='b'.repeat(40), data='catalog fixture';
const sha256=createHash('sha256').update(data).digest('hex');
const env={SUPABASE_URL:'http://localhost:54421',SUPABASE_SERVICE_ROLE_KEY:'test-only',GITHUB_TOKEN:'github-test-only'};
function fixture(installed=[], importStatus=200) {
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/boat_catalog_source?'))return Response.json(installed);
  if(url.includes('api.github.com'))return Response.json([{sha:revision}]);
  if(url.includes('raw.githubusercontent.com'))return new Response(data);
  return Response.json({year:2024,revision,sha256,count:5888},{status:importStatus});
 };
 return {calls,fetcher};
}
test('same upstream commit skips download and import',async()=>{
 const f=fixture([{year:2024,revision,sha256}]);
 assert.equal((await syncBoatCatalog(env,f.fetcher)).status,'unchanged');assert.equal(f.calls.length,2);
});
test('identical contents at another commit skip publication',async()=>{
 const f=fixture([{year:2024,revision:old,sha256}]);
 assert.equal((await syncBoatCatalog(env,f.fetcher)).status,'unchanged');assert.equal(f.calls.length,3);
});
test('changed or missing catalog imports the exact verified snapshot',async()=>{
 for(const installed of [[],[{year:2024,revision:old,sha256:'outdated'}]]) {
  const f=fixture(installed);assert.equal((await syncBoatCatalog(env,f.fetcher)).status,'updated');
  assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),{year:2024,revision});
  assert.equal(f.calls[1].options.headers.Authorization,'Bearer github-test-only');
  assert.equal(f.calls[2].options.headers,undefined);
  assert.equal(f.calls[3].options.headers.Authorization,'Bearer test-only');
 }
});
test('check-only never publishes and failed imports fail the job',async()=>{
 const f=fixture();assert.equal((await syncBoatCatalog({...env,BOAT_CATALOG_CHECK_ONLY:'true'},f.fetcher)).status,'update-available');assert.equal(f.calls.length,3);
 await assert.rejects(syncBoatCatalog(env,fixture([],400).fetcher),/400/);
});
test('metadata errors and invalid upstream commits never invoke the importer',async()=>{
 await assert.rejects(syncBoatCatalog(env,async()=>new Response('',{status:503})),/503/);
 let count=0;
 await assert.rejects(syncBoatCatalog(env,async()=>Response.json(++count===1?[]:[{sha:'main'}])),/valid upstream/);
 assert.equal(count,2);
 await assert.rejects(syncBoatCatalog({...env,BOAT_CATALOG_YEAR:'garbage'}),/Invalid/);
});

test('deployment initializes only an empty catalog and never refreshes existing data',async()=>{
 const f=fixture([{year:2024,revision:old,sha256:'old'}]);
 assert.equal((await syncBoatCatalog({...env,BOAT_CATALOG_INITIAL_ONLY:'true'},f.fetcher)).status,'already-initialized');assert.equal(f.calls.length,1);
});
test('deployment credential lookup is restricted to Veetr and kept out of upstream requests',async()=>{
 const deployment={SUPABASE_URL:'https://xvqlsltglpgfjhdrhdyc.supabase.co',SUPABASE_ACCESS_TOKEN:'test-pat'};
 const resolved=await catalogEnvironment(deployment,async(url,options)=>{
  assert.equal(url,'https://api.supabase.com/v1/projects/xvqlsltglpgfjhdrhdyc/api-keys?reveal=true');
  assert.equal(options.headers.Authorization,'Bearer test-pat');
  return Response.json([{name:'service_role',api_key:'test-key'}]);
 });
 assert.equal(resolved.SUPABASE_SERVICE_ROLE_KEY,'test-key');
 await assert.rejects(catalogEnvironment({...deployment,SUPABASE_URL:'https://other.example'}),/restricted/);
});
