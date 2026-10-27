import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {newSeries, seriesVisibility, setSeriesVisibility, validateSeries} from './domain';
import {SeriesVisibilitySelect} from './SeriesVisibility';

test('legacy active and completed series map to public; new series stay draft', () => {
 assert.equal(seriesVisibility(newSeries()),'draft');
 for (const status of ['active','completed'] as const) assert.equal(seriesVisibility({...newSeries(),status}),'public');
});
test('visibility preserves the wire format and validates invalid combinations', () => {
 const series=newSeries();
 for (const visibility of ['public','unlisted','draft'] as const) {
  setSeriesVisibility(series,visibility); validateSeries(series);
  assert.equal(seriesVisibility(series),visibility);
  assert.equal(series.status,visibility==='draft'?'draft':'active');
 }
 series.visibility='public';
 assert.throws(()=>validateSeries(series),/visibility/);
});
test('the selector offers only visibility choices, defaulting to draft', () => {
 const html=renderToStaticMarkup(<SeriesVisibilitySelect series={newSeries()}/>);
 assert.match(html,/name="visibility"/);
 assert.match(html,/value="draft" selected/);
 assert.match(html,/value="public"/); assert.match(html,/value="unlisted"/);
 assert.doesNotMatch(html,/completed|value="active"/);
});
