import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseGpx} from './courseGpx';
import type {RaceCourse} from './course';
const course: RaceCourse = {marks:[{id:'00000000-0000-4000-8000-000000000001',name:'Private old name',latitude:49.6,longitude:14.2,rounding:'starboard'}],startBearing:{origin:{latitude:49.59,longitude:14.19},degrees:90,distanceMetres:200},notes:'One lap < & >'};
test('GPX exports named endpoints and a midpoint-first route with rounding descriptions',()=>{
 const gpx=courseGpx(course,'Race & <test>');
 assert.match(gpx,/xmlns="http:\/\/www.topografix.com\/GPX\/1\/1"/);
 assert.equal((gpx.match(/<wpt /g)||[]).length,3);
 assert.equal((gpx.match(/<rtept /g)||[]).length,2);
 assert.match(gpx,/<name>Start midpoint<\/name>.*\n.*<name>Mark 1<\/name>/);
 assert.match(gpx,/Leave to starboard \(right\)/);
 assert.match(gpx,/Race &amp; &lt;test&gt;/);
 assert.match(gpx,/One lap &lt; &amp; &gt;/);
 assert.doesNotMatch(gpx,/Private old name/);
});
test('unknown buoy distance exports no fictional B or start midpoint',()=>{
 const gpx=courseGpx({...course,startBearing:{origin:{latitude:49.59,longitude:14.19},degrees:90}},'Race');
 assert.doesNotMatch(gpx,/Start B|Start midpoint/);
 assert.equal((gpx.match(/<wpt /g)||[]).length,2);
 assert.equal((gpx.match(/<rtept /g)||[]).length,1);
});
