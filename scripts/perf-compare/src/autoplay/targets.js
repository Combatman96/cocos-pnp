import fs from 'node:fs';

const DEFAULT_INTERVAL_MS = 400;

// Cocos screen space: canvas pixels, origin bottom-left. CSS: origin top-left.
export function toCssPoint(screen, canvasPx, rect) {
  return {
    x: rect.left + (screen.x * rect.width) / canvasPx.width,
    y: rect.top + rect.height - (screen.y * rect.height) / canvasPx.height,
  };
}

export function sortTargets(points) {
  return points.slice().sort((a, b) => Math.round(a.x) - Math.round(b.x) || a.y - b.y);
}

// Runs in the page. Returns null when the game objects are missing, else CSS
// points of every shooter on top of its queue (the only valid taps).
function beeCubePicker() {
  var cc = window.cc;
  if (!cc || !cc.js || !cc.director) return null;
  var scene = cc.director.getScene();
  var Shooter = cc.js.getClassByName('ShooterItem');
  var Level = cc.js.getClassByName('LevelController');
  if (!scene || !Shooter || !Level) return null;
  var level = scene.getComponentInChildren(Level);
  var camera = level && level.cameraMain;
  var canvas = cc.game && cc.game.canvas;
  if (!camera || !canvas) return null;
  var rect = canvas.getBoundingClientRect();
  var size = { width: canvas.width, height: canvas.height };
  var points = [];
  scene.getComponentsInChildren(Shooter).forEach(function (s) {
    if (!s.node.activeInHierarchy || !s.isAtTop()) return;
    var screen = camera.worldToScreen(s.node.worldPosition, new cc.Vec3());
    points.push(toCssPoint(screen, size, rect));
  });
  return points;
}

export const BEE_CUBE_PICKER =
  'function () { var toCssPoint = ' + toCssPoint.toString() + '; return (' + beeCubePicker.toString() + ')(); }';

export function loadTapScript(json) {
  if (!json || !Array.isArray(json.points) || json.points.length === 0) {
    throw new Error('tap script: points must be a non-empty array of [x, y] in 0..1');
  }
  json.points.forEach((p, i) => {
    const ok = Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && v >= 0 && v <= 1);
    if (!ok) throw new Error(`tap script: point ${i} out of range (need [x, y] in 0..1)`);
  });
  const intervalMs = json.intervalMs ?? DEFAULT_INTERVAL_MS;
  if (!(intervalMs > 0)) throw new Error('tap script: intervalMs must be > 0');
  return { intervalMs, points: json.points };
}

// spec: 'bee-cube' or a path to a tap script JSON file.
export function createTargetSource(spec, viewport) {
  if (spec === 'bee-cube') {
    return { name: 'bee-cube', intervalMs: DEFAULT_INTERVAL_MS, picker: BEE_CUBE_PICKER, fixed: null };
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(spec, 'utf8'));
  } catch (e) {
    throw new Error(`tap script: cannot read ${spec}: ${e.message}`);
  }
  const script = loadTapScript(json);
  return {
    name: spec,
    intervalMs: script.intervalMs,
    picker: null,
    fixed: script.points.map(([x, y]) => ({ x: x * viewport.width, y: y * viewport.height })),
  };
}
