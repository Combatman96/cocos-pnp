import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serveFiles } from '../src/serve.js';

test('serveFiles serves each file at its own URL and 404s everything else', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-'));
  const a = path.join(dir, 'a', 'game.html');
  const b = path.join(dir, 'b', 'game.html');
  fs.mkdirSync(path.dirname(a));
  fs.mkdirSync(path.dirname(b));
  fs.writeFileSync(a, '<p>A</p>');
  fs.writeFileSync(b, '<p>B</p>');

  const server = await serveFiles([a, b], 0);
  try {
    assert.equal(server.urls.length, 2);
    const ra = await fetch(server.urls[0]);
    assert.equal(ra.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(await ra.text(), '<p>A</p>');
    assert.equal(await (await fetch(server.urls[1])).text(), '<p>B</p>');
    const miss = await fetch(new URL('/etc/passwd', server.urls[0]));
    assert.equal(miss.status, 404);
  } finally {
    await server.close();
  }
});
