// Pure aggregation helpers. Non-finite inputs (null, NaN) are dropped.

const JANK_MS = 33.4;

function finite(values) {
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

// Nearest-rank percentile on a sorted array.
function percentile(sorted, p) {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function summarize(values) {
  const xs = finite(values).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) {
    return { n: 0, mean: null, median: null, stdev: null, min: null, max: null, p95: null, p99: null };
  }
  const m = mean(xs);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  const stdev = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : 0;
  return {
    n,
    mean: m,
    median,
    stdev,
    min: xs[0],
    max: xs[n - 1],
    p95: percentile(xs, 95),
    p99: percentile(xs, 99),
  };
}

export function frameStats(deltasMs) {
  const xs = finite(deltasMs);
  if (xs.length === 0) {
    return { fps: null, frameMsMedian: null, frameMsP95: null, frameMsP99: null, jankPct: null };
  }
  const s = summarize(xs);
  return {
    fps: 1000 / s.mean,
    frameMsMedian: s.median,
    frameMsP95: s.p95,
    frameMsP99: s.p99,
    jankPct: (xs.filter((d) => d > JANK_MS).length / xs.length) * 100,
  };
}

export function pctDiff(a, b) {
  return ((b - a) / a) * 100;
}
