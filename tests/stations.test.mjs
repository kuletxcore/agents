import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchStations, stations } from '../src/lib/stations.ts';

test('every static app room has exactly one station', () => {
  const routes = [...readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8').matchAll(/<Route path="([^":*]+)"/g)].map(m => '/' + m[1]);
  assert.deepEqual(stations.map(s => s.path).sort(), ['/', ...routes].sort());
});
test('match tasks, aliases and room names regardless of case or word order', () => {
  for (const query of [' approve  ', 'tool runs', 'APPROVAL']) assert.equal(matchStations(query)[0].path, '/runs');
  assert.equal(matchStations('vault cortex')[0].path, '/memory');
  assert.deepEqual(matchStations('nosuchroom'), []);
  assert.equal(matchStations('').length, stations.length);
});
