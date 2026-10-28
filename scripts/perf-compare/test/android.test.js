import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDevice } from '../src/android.js';

const out = (...lines) => ['List of devices attached', ...lines, ''].join('\r\n');

test('pickDevice returns the single ready device', () => {
  assert.equal(pickDevice(out('R58M123ABC\tdevice')), 'R58M123ABC');
});

test('pickDevice explains each failure', () => {
  assert.throws(() => pickDevice(out()), /no Android device found.*USB debugging/s);
  assert.throws(() => pickDevice(out('R58M\tunauthorized')), /tap "Allow"/);
  assert.throws(() => pickDevice(out('A\tdevice', 'B\tdevice')), /2 devices connected/);
});
