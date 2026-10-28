import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/timeout.js';

test('withTimeout rejects when promise never settles', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20, 'post-draw'), /post-draw timed out after 20ms/);
});

test('withTimeout resolves with value', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 1000, 'x'), 7);
});
