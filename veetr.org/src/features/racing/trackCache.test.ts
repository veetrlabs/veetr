import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrackCache,CHUNK_MS,type TrackMeta,type TrackPoint} from './trackCache';
import {replayCoordinate} from './replay';
const point=(time:number,sessionId='a'):TrackPoint=>({boatId:'boat',boatName:'Boat',sessionId,recordedAt:new Date(time).toISOString(),latitude:time/100000,longitude:10,accuracyM:5,sogMps:1,cogDeg:0,source:'phone'});
const meta:TrackMeta={start:290000,end:310000,heats:[],chunks:[{start:0,count:1,version:'a'},{start:CHUNK_MS,count:1,version:'b'}]};
test('cached chunks support local seeks and interpolation across chunk boundaries',()=>{
 const cache=new TrackCache();cache.put(0,'a',[point(290000)]);cache.put(CHUNK_MS,'b',[point(310000)]);
 const frame=cache.frame(300000);
 assert.equal(frame.length,1);
 assert.deepEqual(replayCoordinate(frame[0],300000),[3,10]);
 assert.equal(cache.frame(290000)[0].recordedAt,new Date(290000).toISOString());
 assert.equal(cache.frame(310000)[0].recordedAt,new Date(310000).toISOString());
 assert.equal(cache.needed(meta,300000).every(c=>cache.has(c.start,c.version)),true);
});
test('late uploads and revoked access invalidate affected cached chunks',()=>{
 const cache=new TrackCache();cache.put(0,'a',[point(290000)]);cache.put(CHUNK_MS,'b',[point(310000)]);
 cache.sync({...meta,chunks:[{start:0,count:2,version:'changed'}]});
 assert.equal(cache.has(0,'changed'),false);assert.equal(cache.has(CHUNK_MS,'b'),false);
 cache.sync({...meta,chunks:[]});
 assert.deepEqual(cache.frame(300000),[]);
});
test('interpolation and trails do not join separate phone sessions',()=>{
 const cache=new TrackCache();cache.put(0,'a',[point(1000,'a'),point(11000,'b')]);
 assert.equal(cache.frame(5000)[0].nextFix,null);
 assert.equal(cache.frame(11000)[0].trail.length,1);
});
test('cache evicts old chunks to bound memory and hides fixes older than five minutes',()=>{
 const cache=new TrackCache();
 for(let i=0;i<10;i++)cache.put(i*CHUNK_MS,String(i),[point(i*CHUNK_MS)]);
 assert.equal(cache.has(0,'0'),false);assert.equal(cache.has(9*CHUNK_MS,'9'),true);
 assert.deepEqual(cache.frame(20*CHUNK_MS),[]);
});
