import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, frameStats, pctDiff } from '../src/stats.js';

test('summarize median', () => {
  assert.equal(summarize([1, 2, 3, 4, 100]).median, 3);
});

test('summarize p95 nearest-rank', () => {
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(summarize(xs).p95, 95);
  assert.equal(summarize(xs).p99, 99);
});

test('summarize empty', () => {
  const s = summarize([]);
  assert.equal(s.n, 0);
  assert.equal(s.mean, null);
  assert.equal(s.median, null);
});

test('summarize ignores non-finite values', () => {
  const s = summarize([1, null, NaN, 3]);
  assert.equal(s.n, 2);
  assert.equal(s.mean, 2);
});

test('frameStats fps ~60', () => {
  const f = frameStats(Array(60).fill(16.67));
  assert.ok(Math.abs(f.fps - 60) < 0.1);
});

test('frameStats jank', () => {
  assert.equal(frameStats([16, 50]).jankPct, 50);
});

test('pctDiff', () => {
  assert.equal(pctDiff(100, 110), 10);
});
