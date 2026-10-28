#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { runOnce } from './src/run-once.js';
import { buildReport, formatTable, makeLabels } from './src/report.js';

const DEFAULT_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: 'string', default: '5' },
    sample: { type: 'string', default: '10000' },
    cpu: { type: 'string', default: '4' },
    timeout: { type: 'string', default: '30000' },
    headless: { type: 'boolean', default: false },
    chrome: { type: 'string', default: process.env.CHROME_PATH || DEFAULT_CHROME },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help || positionals.length === 0) {
  console.log(`Usage: node cli.js <a.html> <b.html> [...]
  --runs N        runs per build (default 5)
  --sample MS     frame/heap sampling window after boot (default 10000)
  --cpu N         CPU throttle rate, 1 = none (default 4)
  --timeout MS    limit for each phase: load, first draw, and measurement after it (default 30000)
  --headless      run headless (FPS then uses software GL; less realistic)
  --chrome PATH   Chrome executable (default CHROME_PATH or ${DEFAULT_CHROME})
  --out FILE      JSON output (default perf-results-<timestamp>.json)`);
  process.exit(positionals.length === 0 && !opts.help ? 1 : 0);
}

const files = [];
for (const p of positionals) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  if (files.some((f) => f.toLowerCase() === abs.toLowerCase())) {
    console.warn(`warning: duplicate path ignored: ${abs}`);
    continue;
  }
  files.push(abs);
}
if (files.length < 2) console.warn('warning: only one build given; nothing to compare against');

const runs = Number(opts.runs);
const cfg = {
  cpuThrottle: Number(opts.cpu),
  sampleMs: Number(opts.sample),
  timeoutMs: Number(opts.timeout),
  viewport: { width: 390, height: 844, deviceScaleFactor: 3 },
};
const labels = makeLabels(files);
if (new Set(labels).size !== labels.length) throw new Error(`labels not unique: ${labels.join(', ')}`);
const results = new Map(labels.map((l, i) => [l, { file: files[i], runs: [] }]));

console.log(
  `mode=${opts.headless ? 'headless (software GL)' : 'headed'} runs=${runs} cpu=${cfg.cpuThrottle}x sample=${cfg.sampleMs}ms`
);

const browser = await puppeteer.launch({
  executablePath: opts.chrome,
  headless: opts.headless,
  args: ['--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
try {
  // Interleave builds so drift (thermal, background load) hits all equally.
  for (let i = 0; i < runs; i++) {
    for (const [label, entry] of results) {
      const r = await runOnce(browser, { file: entry.file, ...cfg });
      entry.runs.push(r);
      const summary = r.ok
        ? `firstDraw=${r.firstDrawMs.toFixed(0)}ms fps=${r.frame.fps?.toFixed(1)} heap=${r.heapAfterLoadMB.toFixed(1)}MB errors=${r.pageErrors.length}`
        : `FAILED: ${r.error}`;
      console.log(`[${i + 1}/${runs}] ${label}: ${summary}`);
    }
  }
} finally {
  await browser.close();
}

const report = buildReport(results);
console.log('\n' + formatTable(report));

const out = path.resolve(opts.out || `perf-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(out, JSON.stringify({ config: { ...cfg, runs, headless: opts.headless }, report, raw: Object.fromEntries(results) }, null, 2));
console.log(`\nraw results: ${out}`);
