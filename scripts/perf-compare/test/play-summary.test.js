import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizePlay } from '../src/play-summary.js';
import { pollWhile } from '../src/poll.js';

const base = { actionsSent: 10, emptyTicks: 1, endedByGame: true };

test('game end is reported relative to play start and bounds long tasks', () => {
  const s = summarizePlay(
    {
      playStart: 1000,
      playEnd: 9000,
      gameEndMs: 6000,
      deltas: [16, 16],
      openCalls: 1,
      longTasks: [
        { start: 500, duration: 100 }, // before play
        { start: 2000, duration: 70 }, // during play
        { start: 7000, duration: 90 }, // after game end
      ],
    },
    base,
    100 * 1024 * 1024
  );
  assert.equal(s.gameEndMs, 5000);
  assert.equal(s.longTaskTotalMs, 70);
  assert.equal(s.heapPeakMB, 100);
  assert.equal(s.openCalls, 1);
});

test('gameEndMs is null when the game did not end', () => {
  const s = summarizePlay(
    { playStart: 0, playEnd: 100, gameEndMs: null, deltas: [], openCalls: 0, longTasks: [] },
    { ...base, endedByGame: false },
    0
  );
  assert.equal(s.gameEndMs, null);
});

test('pollWhile never leaks an unhandled rejection and reports the error on stop', async () => {
  let unhandled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('unhandledRejection', onUnhandled);
  const poll = pollWhile(async () => { throw new Error('target closed'); }, 5);
  await new Promise((r) => setTimeout(r, 30));
  const err = await poll.stop();
  process.off('unhandledRejection', onUnhandled);
  assert.equal(unhandled, 0);
  assert.match(String(err), /target closed/);
});
