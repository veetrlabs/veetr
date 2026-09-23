import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {HeatCreation} from './HeatCreation';
import {heatDetailsFromForm} from './SeriesBrowser';
import {newSeries, id} from './domain';

test('opening the heat form does not save or populate a placeholder heat', () => {
  const series = newSeries('Club series');
  const eventId = id();
  series.events = [{id:eventId, name:'Regatta', order:1, weight:1, completed:false, discards:[]}];
  const before = structuredClone(series);
  let saves = 0;
  const html = render(<HeatCreation series={series} eventId={eventId} save={async () => {saves++;}} navigate={() => {}} />);
  assert.equal(saves, 0);
  assert.deepEqual(series, before);
  assert.match(html, /name="name"[^>]*value=""/);
  assert.match(html, /name="date"[^>]*value=""/);
  assert.match(html, /Create heat/);
  assert.doesNotMatch(html, /name="weight"|name="startingPoints"/);
  assert.doesNotMatch(html, /<table|Heat 1|checked=""/);
});

function data(overrides: Record<string,string> = {}) {
  const form = new FormData();
  for (const [key,value] of Object.entries({name:'  First start  ', event:'event-id', weight:'1', date:'2026-09-22', ...overrides})) form.set(key,value);
  return form;
}
test('heat details preserve user input and require an explicit choice to share results', () => {
  assert.deepEqual(heatDetailsFromForm(data()), {name:'First start', eventId:'event-id',weight:1,date:'2026-09-22',status:'draft'});
  assert.equal(heatDetailsFromForm(data({shared:'on'})).status,'published');
  assert.equal(heatDetailsFromForm(data({weight:'10'})).weight, 1);
});
test('invalid heat details cannot be saved', () => {
  const invalid: Record<string,string>[] = [{name:' '},{event:''},{date:'2026-02-30'},{date:'not-a-date'}];
  for (const values of invalid) assert.throws(() => heatDetailsFromForm(data(values)));
});
