// Injected before any page script. Engine-agnostic: timestamps the first
// WebGL draw call and super_html.game_ready(), samples rAF frame deltas on
// demand, and records long tasks. Page errors come from Puppeteer's
// `pageerror` only. Every hook is guarded so the probe can never break the
// game it measures.

function probe() {
  var w = window;
  var perf = {
    t0: w.performance.now(),
    firstDrawMs: null,
    gameReadyMs: null,
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

  function wrapReady(obj) {
    try {
      if (!obj || typeof obj.game_ready !== 'function' || obj.game_ready.__perfWrapped) return;
      var orig = obj.game_ready;
      var wrapped = function () {
        if (perf.gameReadyMs === null) perf.gameReadyMs = w.performance.now();
        return orig.apply(this, arguments);
      };
      wrapped.__perfWrapped = true;
      obj.game_ready = wrapped;
    } catch (e) {}
  }

  // super_html is assigned (and its game_ready replaced) by later inline
  // scripts, so intercept both the global and the property.
  try {
    var superHtml;
    Object.defineProperty(w, 'super_html', {
      configurable: true,
      get: function () { return superHtml; },
      set: function (v) {
        superHtml = v;
        if (!v || typeof v !== 'object') return;
        var ready = v.game_ready;
        try {
          Object.defineProperty(v, 'game_ready', {
            configurable: true,
            enumerable: true,
            get: function () { return ready; },
            set: function (fn) { ready = fn; wrapReady(v); },
          });
        } catch (e) {}
        wrapReady(v);
      },
    });
  } catch (e) {}

  var sampling = false;
  var prev = null;
  function frame(now) {
    if (!sampling) return;
    if (prev !== null) perf.deltas.push(now - prev);
    prev = now;
    w.requestAnimationFrame(frame);
  }
  function startSampling() {
    perf.deltas = [];
    prev = null;
    sampling = true;
    w.requestAnimationFrame(frame);
  }
  function stopSampling() {
    sampling = false;
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
