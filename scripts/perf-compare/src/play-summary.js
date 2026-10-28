import { frameStats } from './stats.js';

const MB = 1024 * 1024;

// page: what the probe reported at the end of play (performance.now() times).
// The play window ends at game end when the game ended, so end-screen work is
// not counted, and time to game end is measured from play start.
export function summarizePlay(page, driver, heapPeakBytes) {
  const end = page.gameEndMs !== null ? Math.min(page.playEnd, page.gameEndMs) : page.playEnd;
  const tasks = page.longTasks.filter((t) => t.start >= page.playStart && t.start <= end);
  return {
    frame: frameStats(page.deltas),
    longTaskTotalMs: tasks.reduce((a, t) => a + t.duration, 0),
    heapPeakMB: heapPeakBytes / MB,
    actionsSent: driver.actionsSent,
    emptyTicks: driver.emptyTicks,
    endedByGame: driver.endedByGame,
    gameEndMs: page.gameEndMs !== null ? page.gameEndMs - page.playStart : null,
    openCalls: page.openCalls,
  };
}
