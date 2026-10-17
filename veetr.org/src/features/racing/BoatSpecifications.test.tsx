import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {BoatPolarChart,parseBoatPolar,polarCsv} from './BoatSpecifications';
test('CSV round trip preserves chart values and public polar import strips private observation metadata',()=>{
 const polar=parseBoatPolar('TWS,TWA,speed\n6,60,4.123456789\n10,60,6')!;
 assert.deepEqual(parseBoatPolar(polarCsv(polar))!.points,polar.points);
 const json=JSON.stringify({...polar,sessionId:'private-trip',points:polar.points.map(p=>({...p,sessionId:'private-trip',confidence:{level:'high',samples:10,seconds:60,spread:0,lastObservedAt:1}}))});
 assert.doesNotMatch(JSON.stringify(parseBoatPolar(json)),/private-trip|confidence|sessionId/);
 assert.throws(()=>parseBoatPolar('TWS,TWA,speed\n6,181,4'));
 assert.equal(parseBoatPolar(''),undefined);
 const html=renderToStaticMarkup(<BoatPolarChart polar={polar}/>);
 assert.match(html,/6 kn/);assert.match(html,/10 kn/);assert.match(html,/aria-pressed="true"/);
 assert.equal((html.match(/<path /g)??[]).length,2);
});
