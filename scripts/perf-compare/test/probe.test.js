import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PROBE_SOURCE } from '../src/probe.js';

function makeWindow() {
  let now = 0;
  const rafQueue = [];
  const draws = [];
  class GL {}
  GL.prototype.drawArrays = function () { draws.push('arrays'); };
  GL.prototype.drawElements = function () { draws.push('elements'); };
  const win = {
    performance: { now: () => now },
    requestAnimationFrame: (cb) => { rafQueue.push(cb); return rafQueue.length; },
    cancelAnimationFrame: () => {},
    PerformanceObserver: class { observe() {} },
    WebGLRenderingContext: GL,
    addEventListener: () => {},
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(PROBE_SOURCE, ctx);
  return {
    win,
    draws,
    tick(ms) {
      now += ms;
      const cbs = rafQueue.splice(0);
      cbs.forEach((cb) => cb(now));
    },
    setNow(ms) { now = ms; },
  };
}

test('first draw call recorded once and original still called', () => {
  const h = makeWindow();
  const gl = new h.win.WebGLRenderingContext();
  h.setNow(120);
  gl.drawArrays();
  h.setNow(300);
  gl.drawElements();
  assert.equal(h.win.__perf.firstDrawMs, 120);
  assert.deepEqual(h.draws, ['arrays', 'elements']);
});

test('super_html.game_ready assigned later is hooked', () => {
  const h = makeWindow();
  let called = 0;
  h.win.super_html = { game_ready() { called++; } };
  h.setNow(500);
  h.win.super_html.game_ready();
  assert.equal(h.win.__perf.gameReadyMs, 500);
  assert.equal(called, 1);
});

test('sampling records rAF deltas until stopped', () => {
  const h = makeWindow();
  h.win.__perf.startSampling();
  h.tick(16);
  h.tick(16);
  h.tick(20);
  h.win.__perf.stopSampling();
  h.tick(16);
  assert.deepEqual([...h.win.__perf.deltas], [16, 20]);
});

test('probe does not register its own error listener (pageerror is the single source)', () => {
  let added = 0;
  class GL {}
  const win = {
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    PerformanceObserver: class { observe() {} },
    WebGLRenderingContext: GL,
    addEventListener: () => { added++; },
  };
  win.window = win;
  vm.runInContext(PROBE_SOURCE, vm.createContext(win));
  assert.equal(added, 0);
});
