// Injected before any page script. Engine-agnostic: timestamps the first
// WebGL draw call, super_html.game_ready() and game_end(), samples rAF frame deltas on
// demand, and records long tasks. Page errors come from Puppeteer's
// `pageerror` only. Every hook is guarded so the probe can never break the
// game it measures.

function probe() {
  var w = window;
  var perf = {
    t0: w.performance.now(),
    firstDrawMs: null,
    gameReadyMs: null,
    gameEndMs: null,
    openCalls: 0,
    deltas: [],
    longTasks: [],
    startSampling: startSampling,
    stopSampling: stopSampling,
  };
  w.__perf = perf;

  function markDraw() {
    if (perf.firstDrawMs === null) perf.firstDrawMs = w.performance.now();
  }

  ['WebGLRenderingContext', 'WebGL2RenderingContext'].forEach(function (name) {
    try {
      var proto = w[name] && w[name].prototype;
      if (!proto) return;
      ['drawArrays', 'drawElements'].forEach(function (fn) {
        var orig = proto[fn];
        if (typeof orig !== 'function') return;
        proto[fn] = function () {
          markDraw();
          return orig.apply(this, arguments);
        };
      });
    } catch (e) {}
  });

  // Wraps obj[name] so its first call stamps perf[field].
  function wrapHook(obj, name, field) {
    try {
      if (!obj || typeof obj[name] !== 'function' || obj[name].__perfWrapped) return;
      var orig = obj[name];
      var wrapped = function () {
        if (perf[field] === null) {
          perf[field] = w.performance.now();
          // End-screen frames are not gameplay; stop sampling at game end.
          if (field === 'gameEndMs') stopSampling();
        }
        return orig.apply(this, arguments);
      };
      wrapped.__perfWrapped = true;
      obj[name] = wrapped;
    } catch (e) {}
  }

  var HOOKS = [
    ['game_ready', 'gameReadyMs'],
    ['game_end', 'gameEndMs'],
  ];

  // super_html is assigned (and its hooks replaced) by later inline scripts,
  // so intercept both the global and each hooked property.
  try {
    var superHtml;
    Object.defineProperty(w, 'super_html', {
      configurable: true,
      get: function () { return superHtml; },
      set: function (v) {
        superHtml = v;
        if (!v || typeof v !== 'object') return;
        HOOKS.forEach(function (hook) {
          var name = hook[0];
          var field = hook[1];
          var current = v[name];
          try {
            Object.defineProperty(v, name, {
              configurable: true,
              enumerable: true,
              get: function () { return current; },
              set: function (fn) { current = fn; wrapHook(v, name, field); },
            });
          } catch (e) {}
          wrapHook(v, name, field);
        });
      },
    });
  } catch (e) {}

  // The end card's store redirect calls window.open when there is no mraid.
  // Count it instead of letting a popup tab steal focus mid-measurement.
  try {
    w.open = function () {
      perf.openCalls++;
      return null;
    };
  } catch (e) {}

  // Each start bumps the generation, so a callback queued by an earlier
  // start/stop cycle dies instead of running as a second chain.
  var generation = 0;
  var prev = null;
  function chain(gen) {
    return function frame(now) {
      if (gen !== generation) return;
      if (prev !== null) perf.deltas.push(now - prev);
      prev = now;
      w.requestAnimationFrame(frame);
    };
  }
  function startSampling() {
    perf.deltas = [];
    prev = null;
    generation++;
    w.requestAnimationFrame(chain(generation));
  }
  function stopSampling() {
    generation++;
  }

  try {
    new w.PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        perf.longTasks.push({ start: e.startTime, duration: e.duration });
      });
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
}

export const PROBE_SOURCE = '(' + probe.toString() + ')();';
