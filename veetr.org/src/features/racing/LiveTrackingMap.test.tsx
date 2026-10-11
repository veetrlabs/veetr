import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveTrackingMap } from './LiveTrackingMap';

test('replay begins with a loading status and hides the map until coordinates are fitted', () => {
  const html = renderToStaticMarkup(<LiveTrackingMap seriesId="series" eventId="croatia" boatIds={[]} />);
  assert.match(html, /role="status">Loading replay…/);
  assert.match(html, /visibility:hidden/);
  assert.doesNotMatch(html, /49\.7|14\.2/);
});
