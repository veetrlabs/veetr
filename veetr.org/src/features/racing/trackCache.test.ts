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
test('full history survives more than eight chunks and stale boats remain visible',()=>{
 const cache=new TrackCache();
 for(let i=0;i<12;i++)cache.put(i*CHUNK_MS,String(i),[point(i*CHUNK_MS)]);
 assert.equal(cache.has(0,'0'),true);
 assert.equal(cache.frame(20*CHUNK_MS)[0].trail.length,12);
 assert.equal(cache.frame(CHUNK_MS)[0].trail.length,2);
});
test('history loads from the beginning and is not capped at sixty fixes',()=>{
 const cache=new TrackCache();
 const points=Array.from({length:100},(_,i)=>point(i*1000));
 cache.put(0,'a',points);
 assert.equal(cache.frame(99000)[0].trail.length,100);
 assert.deepEqual(cache.needed(meta,10*CHUNK_MS),meta.chunks);
});
test('previous phone sessions remain as separate full trails',()=>{
 const cache=new TrackCache();
 cache.put(0,'a',[point(1000,'a'),point(2000,'a'),point(3000,'b'),point(4000,'b')]);
 const frame=cache.frame(4000)[0];
 assert.deepEqual(frame.trailSegments,[[[.01,10],[.02,10]],[[.03,10],[.04,10]]]);
 assert.equal(frame.trail.length,2);
});

test('GPS outages split trails even within one phone session',()=>{
 const cache=new TrackCache();
 cache.put(0,'a',[point(1000),point(6000),point(80000),point(85000)]);
 assert.equal(cache.frame(85000)[0].trailSegments?.length,2);
 assert.deepEqual(replayCoordinate(cache.frame(40000)[0],40000),[.06,10]);
 assert.deepEqual(cache.frame(85000)[0].trailSegments,[[[.01,10],[.06,10]],[[.8,10],[.85,10]]]);
});
