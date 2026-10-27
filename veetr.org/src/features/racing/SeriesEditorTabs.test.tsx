import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { EntityDetails } from './SeriesBrowser';
import { newSeries } from './domain';

test('series settings and team access have separate addressable panels', () => {
  const series = newSeries();
  for (const editTab of ['settings', 'team'] as const) {
    const html = render(<EntityDetails series={series} location={{seriesId:series.id,editRace:true,editTab}} edit={() => {}} team={<form aria-label="Team form" />} />);
    assert.match(html, /edit-tab=team/);
    assert.match(html, /edit-tab=settings/);
    assert.match(html, new RegExp(`aria-current="page">${editTab === 'team' ? 'Team access' : 'Settings'}`));
    assert.match(html, /Back to series/);
    const panels = html.split('<div class="entity-editor-panel"');
    assert.equal(panels.length,3);
    assert.equal(panels[1].startsWith(' hidden'), editTab === 'team');
    assert.equal(panels[2].startsWith(' hidden'), editTab !== 'team');
  }
});

test('team tab cannot hide settings when the user lacks team management access', () => {
  const series = newSeries();
  const html = render(<EntityDetails series={series} location={{seriesId:series.id,editRace:true,editTab:'team'}} edit={() => {}} />);
  assert.doesNotMatch(html, /entity-editor-tabs|entity-editor-panel" hidden/);
  assert.match(html, /class="race-edit"/);
});
