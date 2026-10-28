import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAutoplay } from '../src/autoplay/driver.js';

const A = { x: 10, y: 50 };
const B = { x: 20, y: 50 };

function fakePage({ targets, endAfterTaps = Infinity }) {
  const taps = [];
  let tick = 0;
  return {
    taps,
    touchscreen: { tap: async (x, y) => { taps.push({ x, y }); } },
    evaluate: async (arg) => {
      if (typeof arg === 'string') return targets(tick++);
      return taps.length >= endAfterTaps;
    },
  };
}

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}

test('fixed targets are tapped round-robin until duration', async () => {
  const page = fakePage({ targets: () => [] });
  const r = await runAutoplay(page, { name: 'fixed', intervalMs: 400, picker: null, fixed: [B, A] }, {
    durationMs: 2000,
    ...fakeClock(),
  });
  assert.equal(r.actionsSent, 5);
  assert.deepEqual(page.taps, [A, B, A, B, A]);
  assert.equal(r.endedByGame, false);
});

test('empty target lists skip the tick without tapping', async () => {
  const page = fakePage({ targets: () => [] });
  const r = await runAutoplay(page, { name: 'bee-cube', intervalMs: 400, picker: 'p', fixed: null }, {
    durationMs: 2000,
    ...fakeClock(),
  });
  assert.equal(r.actionsSent, 0);
  assert.equal(r.emptyTicks, 5);
});

test('game end stops autoplay', async () => {
  const page = fakePage({ targets: () => [A, B], endAfterTaps: 2 });
  const r = await runAutoplay(page, { name: 'bee-cube', intervalMs: 400, picker: 'p', fixed: null }, {
    durationMs: 10000,
    ...fakeClock(),
  });
  assert.equal(r.endedByGame, true);
  assert.equal(r.actionsSent, 2);
});

test('missing game objects on first tick rejects', async () => {
  const page = fakePage({ targets: () => null });
  await assert.rejects(
    runAutoplay(page, { name: 'bee-cube', intervalMs: 400, picker: 'p', fixed: null }, { durationMs: 2000, ...fakeClock() }),
    /autoplay bee-cube: game objects not found/
  );
});

test('null after first tick counts as empty', async () => {
  const page = fakePage({ targets: (t) => (t === 0 ? [A] : null) });
  const r = await runAutoplay(page, { name: 'bee-cube', intervalMs: 400, picker: 'p', fixed: null }, {
    durationMs: 1200,
    ...fakeClock(),
  });
  assert.equal(r.actionsSent, 1);
  assert.equal(r.emptyTicks, 2);
});
