import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {SeriesBrowser, EntityDetails} from './SeriesBrowser';
import {HeatResults} from './SharedResults';
import type {Series} from './domain';
const series = JSON.parse(readFileSync(new URL('../../../imports/orlik-2026/series.json',import.meta.url),'utf8')) as Series;
const noop=()=>{};
test('the same series, race and heat listings expose creation actions only with the matching capability',()=>{
 for (const location of [{}, {seriesId:series.id}, {seriesId:series.id,eventId:series.events![0].id}]) {
  const read=render(<SeriesBrowser seriesList={[series]} location={location} navigate={noop}/>);
  const edit=render(<SeriesBrowser seriesList={[series]} location={location} navigate={noop} edit={noop} create={noop}/>);
  assert.doesNotMatch(read,/New series|New race|New heat/);
  assert.match(edit,/New series|New race|New heat/);
  assert.equal(read.match(/<tbody>.*<\/tbody>/s)?.[0],edit.match(/<tbody>.*<\/tbody>/s)?.[0]);
 }
 const editorOnly=render(<SeriesBrowser seriesList={[series]} location={{}} navigate={noop} edit={noop}/>);
 assert.doesNotMatch(editorOnly,/New series/,'editing an existing series does not grant creation');
});
test('shared entity details require an edit capability, not just a signed-in account',()=>{
 const location={seriesId:series.id};
 const read=render(<EntityDetails series={series} location={location}/>);
 const edit=render(<EntityDetails series={series} location={location} edit={noop}/>);
 assert.ok(read.includes(series.name));assert.ok(edit.includes(series.name));
 assert.doesNotMatch(read,/Edit series|Delete|<form/);assert.match(edit,/Edit series/);
});
test('public heat details contain results and boat links without mutation controls',()=>{
 const race=series.races.find(r=>r.results.length)!;
 const html=render(<HeatResults series={series} race={race}/>);
 assert.match(html,/<table/);assert.match(html,/\?boat=/);
 assert.doesNotMatch(html,/Record finish|Reset results|Undo last|Edit results/);
});
