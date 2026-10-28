import { pathToFileURL } from 'node:url';
import { PROBE_SOURCE } from './probe.js';
import { frameStats } from './stats.js';
import { withTimeout } from './timeout.js';
import { runAutoplay } from './autoplay/driver.js';

const MB = 1024 * 1024;
const SETTLE_MS = 2000;
const HEAP_POLL_MS = 500;
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

export async function runOnce(
  browser,
  { file, cpuThrottle, sampleMs, timeoutMs, viewport, autoplay = null, playMs = 0 },
) {
  const context = await browser.createBrowserContext();
  const pageErrors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));
    await page.setUserAgent(MOBILE_UA);
    await page.setViewport({ ...viewport, isMobile: true, hasTouch: true });

    const cdp = await page.createCDPSession();
    await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    await page.evaluateOnNewDocument(PROBE_SOURCE);

    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForFunction(() => window.__perf && window.__perf.firstDrawMs !== null, {
      timeout: timeoutMs,
      polling: 50,
    });
    // Post-draw phase has its own limit so a hung page cannot stall the tool.
    return await withTimeout(
      measure(page, cdp, sampleMs, pageErrors, autoplay, playMs),
      SETTLE_MS + sampleMs + (autoplay ? playMs : 0) + timeoutMs,
      'measurement after first draw',
    );
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e), pageErrors };
  } finally {
    await context.close().catch(() => {});
  }
}

async function measure(page, cdp, sampleMs, pageErrors, autoplay, playMs) {
  await sleep(SETTLE_MS);

  const boot = await metrics(cdp);
  const heapAfterLoad = boot.JSHeapUsedSize;

  await page.evaluate(() => window.__perf.startSampling());
  let heapPeak = heapAfterLoad;
  const end = Date.now() + sampleMs;
  while (Date.now() < end) {
    await sleep(HEAP_POLL_MS);
    heapPeak = Math.max(heapPeak, (await metrics(cdp)).JSHeapUsedSize);
  }
  const probe = await page.evaluate(() => {
    window.__perf.stopSampling();
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const p = window.__perf;
    return {
      firstDrawMs: p.firstDrawMs,
      gameReadyMs: p.gameReadyMs,
      deltas: p.deltas.slice(),
      longTasks: p.longTasks.slice(),
      domContentLoadedMs: nav.domContentLoadedEventEnd ?? null,
      loadEventMs: nav.loadEventEnd ?? null,
    };
  });

  const play = autoplay ? await playPhase(page, cdp, autoplay, playMs) : null;

  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const heapAfterGc = (await metrics(cdp)).JSHeapUsedSize;

  // Boot window = first draw + settle, same window as the CDP boot metrics.
  // First draw may be a splash frame, so scene init lands in the settle time.
  const bootEnd = probe.firstDrawMs + SETTLE_MS;
  const bootTasks = probe.longTasks.filter((t) => t.start <= bootEnd);
  return {
    ok: true,
    firstDrawMs: probe.firstDrawMs,
    gameReadyMs: probe.gameReadyMs,
    domContentLoadedMs: probe.domContentLoadedMs,
    loadEventMs: probe.loadEventMs,
    scriptDurationMs: boot.ScriptDuration * 1000,
    taskDurationMs: boot.TaskDuration * 1000,
    longTaskCount: probe.longTasks.length,
    longTaskTotalMs: bootTasks.reduce((a, t) => a + t.duration, 0),
    heapAfterLoadMB: heapAfterLoad / MB,
    heapPeakMB: heapPeak / MB,
    heapAfterGcMB: heapAfterGc / MB,
    frame: frameStats(probe.deltas),
    pageErrors: pageErrors.slice(),
    play,
  };
}

// Drives the game with autoplay while sampling frames and polling heap.
async function playPhase(page, cdp, autoplay, playMs) {
  const playStart = await page.evaluate(() => {
    window.__perf.startSampling();
    return performance.now();
  });
  let playing = true;
  let heapPeak = 0;
  const pollHeap = async () => {
    while (playing) {
      heapPeak = Math.max(heapPeak, (await metrics(cdp)).JSHeapUsedSize);
      await sleep(HEAP_POLL_MS);
    }
  };
  const poller = pollHeap();
  let result;
  try {
    result = await runAutoplay(page, autoplay, { durationMs: playMs });
  } finally {
    playing = false;
    await poller;
  }
  const p = await page.evaluate(() => {
    window.__perf.stopSampling();
    const perf = window.__perf;
    return {
      playEnd: performance.now(),
      deltas: perf.deltas.slice(),
      longTasks: perf.longTasks.slice(),
      gameEndMs: perf.gameEndMs,
      openCalls: perf.openCalls,
    };
  });
  const playTasks = p.longTasks.filter((t) => t.start >= playStart && t.start <= p.playEnd);
  return {
    frame: frameStats(p.deltas),
    longTaskTotalMs: playTasks.reduce((a, t) => a + t.duration, 0),
    heapPeakMB: heapPeak / MB,
    actionsSent: result.actionsSent,
    emptyTicks: result.emptyTicks,
    endedByGame: result.endedByGame,
    gameEndMs: p.gameEndMs,
    openCalls: p.openCalls,
  };
}
