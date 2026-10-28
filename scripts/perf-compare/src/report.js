import { summarize, pctDiff } from './stats.js';

// [key, display name, unit, pick(run), lowerIsBetter]
export const METRICS = [
  ['firstDrawMs', 'first draw', 'ms', (r) => r.firstDrawMs, true],
  ['loadEventMs', 'load event', 'ms', (r) => r.loadEventMs, true],
  ['scriptDurationMs', 'script time to first draw + 2s', 'ms', (r) => r.scriptDurationMs, true],
  ['longTaskTotalMs', 'long tasks to first draw + 2s', 'ms', (r) => r.longTaskTotalMs, true],
  ['fps', 'fps', '', (r) => r.frame && r.frame.fps, false],
  ['frameMsP95', 'frame p95', 'ms', (r) => r.frame && r.frame.frameMsP95, true],
  ['frameMsP99', 'frame p99', 'ms', (r) => r.frame && r.frame.frameMsP99, true],
  ['jankPct', 'jank frames', '%', (r) => r.frame && r.frame.jankPct, true],
  ['heapAfterLoadMB', 'heap after load', 'MB', (r) => r.heapAfterLoadMB, true],
  ['heapPeakMB', 'heap peak', 'MB', (r) => r.heapPeakMB, true],
  ['heapAfterGcMB', 'heap after GC', 'MB', (r) => r.heapAfterGcMB, true],
];

// Shortest trailing path that is unique: basename, then add parent folders.
export function makeLabels(files) {
  const parts = files.map((f) => f.replace(/\.html?$/i, '').split(/[\\/]+/).filter(Boolean));
  return parts.map((p, i) => {
    for (let depth = 1; depth <= p.length; depth++) {
      const label = p.slice(-depth).join('/');
      const clash = parts.some((q, j) => j !== i && q.slice(-depth).join('/') === label);
      if (!clash) return label;
    }
    return `${p.join('/')}#${i + 1}`;
  });
}

// results: Map<label, { file, runs: RunResult[] }>
export function buildReport(results) {
  const builds = [];
  for (const [label, { file, runs }] of results) {
    const ok = runs.filter((r) => r.ok);
    const metrics = {};
    for (const [key, , , pick] of METRICS) metrics[key] = summarize(ok.map(pick));
    builds.push({
      label,
      file,
      okRuns: ok.length,
      failedRuns: runs.length - ok.length,
      pageErrorCount: runs.reduce((a, r) => a + (r.pageErrors ? r.pageErrors.length : 0), 0),
      errors: runs.filter((r) => !r.ok).map((r) => r.error),
      metrics,
    });
  }
  return { builds };
}

function fmt(v, digits = 1) {
  return v === null || v === undefined ? '-' : v.toFixed(digits);
}

// Difference is flagged when it exceeds 2 standard errors of the difference
// of means. Rough, but enough to separate signal from run-to-run noise.
function significant(a, b) {
  if (a.n < 2 || b.n < 2) return false;
  const se = Math.sqrt(a.stdev ** 2 / a.n + b.stdev ** 2 / b.n);
  return Math.abs(b.mean - a.mean) > 2 * se;
}

export function formatTable(report) {
  const { builds } = report;
  const head = ['metric', ...builds.map((b) => b.label)];
  if (builds.length > 1) head.push(...builds.slice(1).map((b) => `Δ ${b.label}`));
  const rows = [head];

  for (const [key, name, unit, , lowerIsBetter] of METRICS) {
    const cells = [unit ? `${name} (${unit})` : name];
    for (const b of builds) {
      const s = b.metrics[key];
      cells.push(s.n ? `${fmt(s.median)} ±${fmt(s.stdev)}` : '-');
    }
    const ref = builds[0].metrics[key];
    for (const b of builds.slice(1)) {
      const s = b.metrics[key];
      if (!ref.n || !s.n || !ref.median) {
        cells.push('-');
        continue;
      }
      const d = pctDiff(ref.median, s.median);
      const worse = lowerIsBetter ? d > 0 : d < 0;
      const flag = significant(ref, s) ? (worse ? ' * worse' : ' * better') : '';
      cells.push(`${d >= 0 ? '+' : ''}${d.toFixed(1)}%${flag}`);
    }
    rows.push(cells);
  }

  const status = ['runs ok/failed', ...builds.map((b) => `${b.okRuns}/${b.failedRuns}`)];
  const errs = ['page errors', ...builds.map((b) => String(b.pageErrorCount))];
  rows.push(status, errs);

  const widths = head.map((_, c) => Math.max(...rows.map((r) => (r[c] || '').length)));
  const line = (r) => r.map((cell, c) => (cell || '').padEnd(widths[c])).join('  ');
  const out = [line(rows[0]), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.slice(1).map(line)];
  out.push('', 'cells: median ±stdev over ok runs. Δ: median vs first build. * = beyond 2 std errors (likely real).');
  return out.join('\n');
}
