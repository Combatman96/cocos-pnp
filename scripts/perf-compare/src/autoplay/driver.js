import { sortTargets } from './targets.js';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Taps live targets round-robin every source.intervalMs until durationMs
// passes or the game calls super_html.game_end().
export async function runAutoplay(page, source, { durationMs, now = Date.now, sleep = realSleep }) {
  const start = now();
  let actionsSent = 0;
  let emptyTicks = 0;
  let endedByGame = false;
  let first = true;

  while (now() - start < durationMs) {
    const targets = source.fixed ?? (await page.evaluate('(' + source.picker + ')()'));
    if (targets === null && first) throw new Error(`autoplay ${source.name}: game objects not found`);
    first = false;

    if (targets && targets.length) {
      const sorted = sortTargets(targets);
      const t = sorted[actionsSent % sorted.length];
      await page.touchscreen.tap(t.x, t.y);
      actionsSent++;
    } else {
      emptyTicks++;
    }

    if (await page.evaluate(() => window.__perf.gameEndMs !== null)) {
      endedByGame = true;
      break;
    }
    await sleep(source.intervalMs);
  }

  return { actionsSent, emptyTicks, endedByGame, elapsedMs: now() - start };
}
