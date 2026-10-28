import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, formatTable, makeLabels } from '../src/report.js';

const run = (firstDrawMs, fps) => ({
  ok: true,
  firstDrawMs,
  loadEventMs: 1000,
  scriptDurationMs: 500,
  frame: { fps, frameMsMedian: 16, frameMsP95: 17, frameMsP99: 20, jankPct: 0 },
  heapAfterLoadMB: 50,
  pageErrors: [],
});

function sample() {
  const results = new Map();
  results.set('A', { file: 'a.html', runs: [run(100, 60), run(100, 60), run(100, 60)] });
  results.set('B', {
    file: 'b.html',
    runs: [run(110, 58), run(110, 58), { ok: false, error: 'timeout', pageErrors: ['boom'] }],
  });
  return results;
}

test('buildReport counts failures and excludes them from metrics', () => {
  const r = buildReport(sample());
  const b = r.builds[1];
  assert.equal(b.okRuns, 2);
  assert.equal(b.failedRuns, 1);
  assert.equal(b.pageErrorCount, 1);
  assert.equal(b.metrics.firstDrawMs.n, 2);
  assert.equal(b.metrics.fps.median, 58);
});

test('formatTable shows labels and percent diff vs first build', () => {
  const t = formatTable(buildReport(sample()));
  assert.match(t, /A/);
  assert.match(t, /B/);
  assert.match(t, /\+10\.0%/);
});

test('makeLabels keeps labels unique for same basename', () => {
  const labels = makeLabels(['x/one/game.html', 'x/two/game.html']);
  assert.equal(new Set(labels).size, 2);
});

test('makeLabels unique when parent folders also match', () => {
  const labels = makeLabels(['a/x/game.html', 'b/x/game.html', 'c/y/other.html']);
  assert.equal(new Set(labels).size, 3);
  assert.equal(labels[2], 'other');
});

test('boot metric labels state their window', () => {
  const t = formatTable(buildReport(sample()));
  assert.match(t, /first draw \+ 2s/);
});

const playRun = (fps, ended) => ({
  ...run(100, 60),
  play: {
    frame: { fps, frameMsMedian: 16, frameMsP95: 20, frameMsP99: 30, jankPct: 1 },
    longTaskTotalMs: 200,
    heapPeakMB: 90,
    actionsSent: 40,
    emptyTicks: 0,
    endedByGame: ended,
    gameEndMs: ended ? 15000 : null,
    openCalls: 0,
  },
});

test('play rows appear when runs have play data', () => {
  const results = new Map([
    ['A', { file: 'a.html', runs: [playRun(55, true), playRun(56, false)] }],
    ['B', { file: 'b.html', runs: [playRun(50, false), playRun(51, false)] }],
  ]);
  const r = buildReport(results);
  assert.equal(r.builds[0].gamesEnded, 1);
  const t = formatTable(r);
  assert.match(t, /play fps/);
  assert.match(t, /games ended\s+1\s+0/);
});

test('play rows are omitted without autoplay', () => {
  const t = formatTable(buildReport(sample()));
  assert.doesNotMatch(t, /play fps/);
  assert.doesNotMatch(t, /games ended/);
});
