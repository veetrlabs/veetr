import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {Editor} from './SeriesBrowser';
import {HeatTrackingTimes, heatTimeValues} from './HeatTrackingTimes';
import {newSeries} from './domain';
import {newEventHeat} from './eventDefaults';

test('heat editor contains actual recording times without a nested form', () => {
  const series = newSeries();
  series.events = [{id:'event', name:'Race', order:1, weight:1, completed:false, discards:[]}];
  const heat = newEventHeat(series, 'event', 'Heat 1');
  const html = render(<Editor series={series} heat={heat} save={()=>{}} onCancel={()=>{}}/>);
  assert.match(html, /Actual start/);
  assert.match(html, /Actual end/);
  assert.equal((html.match(/<form\b/g)||[]).length, 1);
  assert.doesNotMatch(html, /Edit replay times|Save times/);
  const actions = render(<HeatTrackingTimes heatId={heat.id}/>);
  assert.match(actions, /Start heat/);
  assert.doesNotMatch(actions, /datetime-local|Edit replay times/);
});

test('actual times accept an ongoing heat but reject reversed and future ranges', () => {
  assert.equal(heatTimeValues('2020-01-01T10:00:00', '').p_end, null);
  assert.throws(()=>heatTimeValues('2020-01-01T10:00:00','2020-01-01T09:00:00'));
  assert.throws(()=>heatTimeValues('2099-01-01T10:00:00',''));
});
