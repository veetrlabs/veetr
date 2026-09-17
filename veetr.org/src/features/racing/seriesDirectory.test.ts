import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSeries } from './domain';
import { mergeSeriesDirectory } from './seriesDirectory';

test('shared listing merges accessible drafts and published series without duplicates', () => {
  const own = newSeries();
  const draft = {...newSeries(), id: 'private-draft'};
  const published = {id:own.id,name:'Published name',year:own.year,description:'',status:own.status,raceCount:0,boatCount:0};
  assert.deepEqual(mergeSeriesDirectory([published], []), [published]);
  const combined = mergeSeriesDirectory([published], [own, draft]);
  assert.equal(combined.length, 2);
  assert.equal(combined.find(s=>s.id===own.id)?.name, own.name);
  assert.ok(combined.some(s=>s.id===draft.id));
  assert.equal(mergeSeriesDirectory([published], []).some(s=>s.id===draft.id),false);
});
