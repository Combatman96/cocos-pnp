import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { toCssPoint, sortTargets, BEE_CUBE_PICKER, loadTapScript } from '../src/autoplay/targets.js';

test('toCssPoint maps bottom-left canvas pixels to top-left CSS pixels', () => {
  const canvas = { width: 1080, height: 1920 };
  const rect = { left: 0, top: 0, width: 390, height: 693 };
  assert.deepEqual(toCssPoint({ x: 540, y: 1920 }, canvas, rect), { x: 195, y: 0 });
  assert.deepEqual(toCssPoint({ x: 0, y: 0 }, canvas, rect), { x: 0, y: 693 });
});

test('sortTargets orders by x then y', () => {
  const sorted = sortTargets([{ x: 300, y: 5 }, { x: 100, y: 9 }, { x: 100, y: 2 }]);
  assert.deepEqual(sorted, [{ x: 100, y: 2 }, { x: 100, y: 9 }, { x: 300, y: 5 }]);
});

function runPicker(globals) {
  const ctx = vm.createContext({ ...globals });
  ctx.window = ctx;
  return vm.runInContext(`(${BEE_CUBE_PICKER})()`, ctx);
}

test('bee-cube picker returns null without cc', () => {
  assert.equal(runPicker({}), null);
});

test('bee-cube picker returns screen points of top shooters only', () => {
  class Vec3 { constructor() { this.x = 0; this.y = 0; this.z = 0; } }
  const shooter = (x, y, top) => ({
    node: { activeInHierarchy: true, worldPosition: { x, y, z: 0 } },
    isAtTop: () => top,
  });
  const ShooterItem = {};
  const LevelController = {};
  const camera = {
    worldToScreen(p, out) { out.x = p.x; out.y = p.y; return out; },
  };
  const scene = {
    getComponentInChildren: (cls) => (cls === LevelController ? { cameraMain: camera } : null),
    getComponentsInChildren: (cls) => (cls === ShooterItem ? [shooter(540, 960, true), shooter(100, 100, false)] : []),
  };
  const cc = {
    Vec3,
    js: { getClassByName: (n) => ({ ShooterItem, LevelController })[n] || null },
    director: { getScene: () => scene },
    game: {
      canvas: {
        width: 1080,
        height: 1920,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 693 }),
      },
    },
  };
  const points = runPicker({ cc });
  assert.equal(points.length, 1);
  assert.deepEqual({ ...points[0] }, { x: 195, y: 346.5 });
});

test('loadTapScript validates points', () => {
  assert.throws(() => loadTapScript({ points: [[0.5, 1.2]] }), /tap script: point 0 out of range/);
  assert.throws(() => loadTapScript({}), /tap script: points/);
  assert.equal(loadTapScript({ points: [[0.5, 0.5]] }).intervalMs, 400);
});
