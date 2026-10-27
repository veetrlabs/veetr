import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicNotFound, isPublicNotFound } from './PublicNotFound';

test('unavailable public routes show a generic 404 without revealing draft status', () => {
  const html = renderToStaticMarkup(<PublicNotFound />);
  assert.match(html, /404 — Not found/);
  assert.match(html, /Back to races/);
  assert.doesNotMatch(html, /draft|loading/i);
});

test('network failures are not treated as missing series', () => {
  assert.equal(isPublicNotFound({code:'PT404'}), true);
  assert.equal(isPublicNotFound({code:'22P02'}), true);
  assert.equal(isPublicNotFound(new Error('Failed to fetch')), false);
  assert.equal(isPublicNotFound({code:'57014'}), false);
});
