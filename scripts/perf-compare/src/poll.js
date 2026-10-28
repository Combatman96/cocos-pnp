const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Calls fn every intervalMs until stop(). The first error ends the loop and
// is returned by stop() instead of surfacing as an unhandled rejection.
export function pollWhile(fn, intervalMs, sleep = realSleep) {
  let running = true;
  let error;
  const loop = (async () => {
    try {
      while (running) {
        await fn();
        await sleep(intervalMs);
      }
    } catch (e) {
      error = e;
    }
  })();
  return {
    async stop() {
      running = false;
      await loop;
      return error;
    },
  };
}
