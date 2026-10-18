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
test('heat details preserve user input without overriding race visibility', () => {
  assert.deepEqual(heatDetailsFromForm(data()), {name:'First start', eventId:'event-id',weight:1,date:'2026-09-22'});
  assert.equal('status' in heatDetailsFromForm(data({shared:'on'})),false);
  assert.equal(heatDetailsFromForm(data({weight:'10'})).weight, 1);
});
test('invalid heat details cannot be saved', () => {
  const invalid: Record<string,string>[] = [{name:' '},{event:''},{date:'2026-02-30'},{date:'not-a-date'}];
  for (const values of invalid) assert.throws(() => heatDetailsFromForm(data(values)));
});

test('new heat form prefills the local race date and has no per-heat publication checkbox', () => {
  const series = newSeries();
  series.events = [{id:"event",name:"Race",order:1,weight:1,completed:false,discards:[],scheduledStart:new Date(2026,9,18,10).toISOString()}];
  const html = render(<HeatCreation series={series} eventId="event" save={async () => {}} navigate={() => {}} />);
  assert.match(html, /name="date"[^>]*value="2026-10-18"/);
  assert.doesNotMatch(html, /name="shared"/);
  assert.match(html, /Visibility is set for the whole race/);
});
