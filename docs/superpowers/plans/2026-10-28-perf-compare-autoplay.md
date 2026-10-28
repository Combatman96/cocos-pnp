# perf-compare Autoplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an autoplay phase to `scripts/perf-compare` that drives real gameplay with real touch input, so the report also covers frame time, long tasks and heap under load, not only boot and idle.

**Architecture:** After the existing boot and idle phases, a new play phase runs for `--play` ms. An autoplay driver asks a *target source* for tap points every `intervalMs` and taps them round-robin with `page.touchscreen.tap` (real CDP touch events, so the game's input path is exercised). Two target sources: `bee-cube` reads live game state through the global `cc` (top-of-queue `ShooterItem`s projected to screen); a generic JSON tap script gives fixed normalized points for any game. The probe gains a `super_html.game_end` hook (play stops early on game end) and a `window.open` stub (CTA must not open a popup tab mid-measure).

**Tech Stack:** Node 24 ESM, `puppeteer-core` (already a dependency), `node:test`.

**Spec:** user request in chat (2026-10-28): "implement the benchmark tool with autoplay function, so the report is more complete", target project `d:\Cocos Projects\bee-cube-game-3d`. Builds on plan `C:\Users\chuongpt\.claude\plans\d-cocos-projects-hive-block-pla-build-i-logical-shamir.md` (the existing tool).

## Context (facts the implementer cannot rediscover cheaply)

- bee-cube is Cocos Creator 3.8.6. Design resolution is 1080x1920 portrait with fitHeight. Builds: `d:\Cocos Projects\bee-cube-game-3d\build\261006_pBBZ_PAIH_CubeCheo\applovin\261006_pBBZ_PAIH_CubeCheo_applovin.html` (and `CubeRach`).
- Verified at runtime in that build: `window.cc` exists, `cc.director.getScene().name === 'mainScene'`, `cc.js.getClassByName('ShooterItem')` and `('LevelController')` resolve. The scene has 250 `ShooterItem` components.
- A valid move is a single tap on a shooter that is top of its queue. Source: `assets/_ikame/scripts/gameplay/controllers/LevelController.ts:417-450`, which raycasts with `cameraMain.screenPointToRay` and calls `ShooterItem.onTouchShooter`. Invalid taps are harmless (shake + SFX).
- The first tap anywhere leaves the Idle screen (`IdleScreen.ts:42-46`). So round-robin shooter taps also start the game. No state reading is needed.
- `ShooterItem.isAtTop()` (`gameplay/flows/ShooterItem/ShooterItem.ts:341`). `LevelController.cameraMain` is a TS-private field holding a `cc.Camera`. TS `private` is not enforced at runtime.
- cocos-pnp obfuscation (`packages/playable-adapter-core/src/helpers/obfuscate.ts:52-75`) sets `renameGlobals: false`, `stringArray: false` and no `renameProperties`. So `cc`, ccclass names and property names survive obfuscation, and the picker works on obfuscated builds.
- On win or lose the game calls `super_html.game_end()`. After 5 s it calls `super_html.download()`, which calls `window.open` when there is no mraid. Only one level exists, so a win ends the game.
- Layout and timing drift between runs (`Math.random` in bee flight, map auto-rotate). Moves must come from live state each tick, never replayed timestamps.

## Global Constraints

- No change to the bee-cube project and no change to the HTML builds. All autoplay logic lives in `scripts/perf-compare`.
- Without `--autoplay`, CLI output and `RunResult` are unchanged except for new keys set to `null`. Existing 18 tests stay green.
- Defaults: `--play 20000` ms (used only with `--autoplay`), tap `intervalMs` `400` for `bee-cube`, idle `--sample` stays `10000` and accepts `0` to skip idle.
- Both builds in a comparison get the identical policy: same interval, same round-robin order (targets sorted by screen x, then y).

## Review Focus

1. `cc` missing or class not found (non-Cocos build, or a build that renames classes): the picker returns `null`, the run is marked `ok:false` with error `autoplay bee-cube: game objects not found`, and other runs continue. Test in Task 2.
2. Zero valid targets at a tick (conveyor full, animation in flight): the driver skips that tick without tapping and without crashing. Test in Task 3.
3. Game ends mid-play: play stops at `gameEndMs`, and play metrics cover only frames before the end. Test in Task 3 (stop condition); run-once wires it.
4. CTA `window.open` after the end: the stub returns `null`, `openCalls` is counted, and no new tab opens. Test in Task 1.
5. Tap script JSON with points outside `[0,1]` or with missing `points`: `loadTapScript` throws a clear message before Chrome launches. Test in Task 2.

---

## File Structure

- Modify `scripts/perf-compare/src/probe.js`: add `gameEndMs`, `openCalls`, and the `window.open` stub.
- Create `scripts/perf-compare/src/autoplay/targets.js`: the `bee-cube` in-page picker, the tap-script loader, and the pure coordinate helpers.
- Create `scripts/perf-compare/src/autoplay/driver.js`: the round-robin tap loop.
- Modify `scripts/perf-compare/src/run-once.js`: add the play phase.
- Modify `scripts/perf-compare/src/report.js`: add the play metric rows.
- Modify `scripts/perf-compare/cli.js`: add the `--autoplay` and `--play` flags.
- Add tests in `scripts/perf-compare/test/autoplay-targets.test.js` and `scripts/perf-compare/test/autoplay-driver.test.js`, and extend `test/probe.test.js` and `test/report.test.js`.

### Task 1: Probe — game end + window.open stub

**Files:** Modify `src/probe.js`. Test `test/probe.test.js`.

**Interfaces — Produces:** `window.__perf.gameEndMs: number|null` (first `super_html.game_end()` call) and `window.__perf.openCalls: number`. `window.open` is replaced with a function that increments `openCalls` and returns `null`.

- [ ] Step 1: tests (reuse `makeWindow` in probe.test.js; add `open: () => 'real'` to the stub window):
  - `'game_end assigned later is hooked'`: assign `win.super_html = { game_ready(){}, game_end(){ called++ } }`, set now=900, call `game_end()` twice. Expect `gameEndMs === 900` and `called === 2`.
  - `'window.open is stubbed and counted'`: `win.open('x')` returns `null`, and `win.__perf.openCalls === 1`.
- [ ] Step 2: `npm test` → those 2 FAIL.
- [ ] Step 3: generalize `wrapReady` into `wrapHook(obj, name, field)` used for `game_ready→gameReadyMs` and `game_end→gameEndMs`. The setter on `super_html` re-wraps both names.
- [ ] Step 4: `npm test` → 20/20 PASS.
- [ ] Step 5: commit `feat(perf-compare): probe game_end hook and window.open stub`.

### Task 2: Target sources

**Files:** Create `src/autoplay/targets.js` and `test/autoplay-targets.test.js`.

**Interfaces — Produces:**
- `toCssPoint(screen: {x,y}, canvasPx: {width,height}, rect: {left,top,width,height}) -> {x,y}`. Cocos screen space is canvas pixels with the origin at bottom-left. Formula: `x = rect.left + screen.x * rect.width / canvasPx.width`, `y = rect.top + rect.height - screen.y * rect.height / canvasPx.height`.
- `sortTargets(points: {x,y}[]) -> {x,y}[]`: sort by x, then y, with x rounded to 1 px.
- `BEE_CUBE_PICKER: string`: source of an in-page function taking no arguments. It returns `null` if `cc`, the scene, `LevelController` or `ShooterItem` is missing. Otherwise it returns `{x,y}[]` CSS points for every `ShooterItem` with `node.activeInHierarchy && isAtTop()`, projected with `levelController.cameraMain.worldToScreen(node.worldPosition, new cc.Vec3())`, then `toCssPoint` with `cc.game.canvas` size and `getBoundingClientRect()`. Build it as `'(' + fn + ')'`, with `toCssPoint` inlined via `.toString()`.
- `loadTapScript(json: object) -> { intervalMs: number, points: [number, number][] }`. Requires a non-empty `points` array, each point in `[0,1]`. `intervalMs` defaults to `400`. On bad input it throws `Error('tap script: <reason>')`.
- `createTargetSource(spec: string, viewport: {width,height}) -> { name, intervalMs, picker: string|null, fixed: {x,y}[]|null }`. `'bee-cube'` gives `picker = BEE_CUBE_PICKER`, `intervalMs 400`. Any other spec is a path to a JSON file read with `fs.readFileSync`; its normalized points are multiplied by the viewport.

- [ ] Step 1: tests:
  - `toCssPoint({x:540,y:1920},{width:1080,height:1920},{left:0,top:0,width:390,height:693})` → `{x:195, y:0}`; `{x:0,y:0}` → `{x:0, y:693}`.
  - `sortTargets([{x:300,y:5},{x:100,y:9},{x:100,y:2}])` → x order 100,100,300 and y 2 before 9.
  - BEE_CUBE_PICKER evaluated in `node:vm` with no `cc` → `null`. With a fake `cc` (scene whose `getComponentsInChildren` returns 2 shooters, one `isAtTop()` false; camera `worldToScreen` copies x,y) → 1 point.
  - `loadTapScript({points:[[0.5,1.2]]})` throws `/tap script: point 0 out of range/`; `loadTapScript({})` throws `/tap script: points/`; a valid script defaults `intervalMs` to 400.
- [ ] Step 2: `npm test` → FAIL (module missing).
- [ ] Step 3: implement.
- [ ] Step 4: `npm test` → PASS.
- [ ] Step 5: commit `feat(perf-compare): autoplay target sources`.

### Task 3: Autoplay driver

**Files:** Create `src/autoplay/driver.js` and `test/autoplay-driver.test.js`.

**Interfaces:**
- Consumes `createTargetSource` result, `sortTargets`.
- Produces `runAutoplay(page, source, { durationMs, now = Date.now, sleep }) -> Promise<{ actionsSent: number, emptyTicks: number, endedByGame: boolean, elapsedMs: number }>`.
  - Each tick reads targets: `source.fixed`, or `await page.evaluate(source.picker)`. If the picker returns `null` on the first tick, throw `Error('autoplay <name>: game objects not found')`. A later `null` counts as an empty tick.
  - If there are targets, tap `sorted[i % len]` via `page.touchscreen.tap(x, y)` and increment `i`.
  - Check `await page.evaluate(() => window.__perf.gameEndMs !== null)`. If true, stop with `endedByGame: true`.
  - `await sleep(source.intervalMs)`. Stop when `now() - start >= durationMs`.
  - `now` and `sleep` are injectable for tests.

- [ ] Step 1: tests with a fake page (`evaluate` dispatching on the argument, `touchscreen.tap` recording calls) and a fake clock where `sleep` advances `now`:
  - fixed 2 points, durationMs 2000, interval 400 → 5 taps, alternating point A, B, A, B, A.
  - the picker returns `[]` on every tick → 0 taps, `emptyTicks === 5`, no throw.
  - game end reported after the 2nd tick → `endedByGame === true`, 2 taps.
  - the picker returns `null` on the first tick → rejects `/game objects not found/`.
- [ ] Step 2: `npm test` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npm test` → PASS.
- [ ] Step 5: commit `feat(perf-compare): autoplay driver`.

### Task 4: Play phase in run + report + CLI

**Files:** Modify `src/run-once.js`, `src/report.js`, `cli.js`, and `test/report.test.js`.

**Interfaces:**
- `runOnce(browser, { ..., autoplay: source|null, playMs })`. After the idle phase, if `autoplay` is set:
  - record `playStart = performance.now()` in the page
  - call `__perf.startSampling()`
  - run `runAutoplay` while polling heap every 500 ms for `playHeapPeakMB`. Run the heap poll concurrently with the driver via `Promise.all` and a shared stop flag.
  - call `stopSampling()`
  - read long tasks with `start` in `[playStart, playEnd]`
- The post-draw timeout grows by `playMs`.
- `RunResult` adds `play: null | { frame: frameStats, longTaskTotalMs, heapPeakMB, actionsSent, emptyTicks, endedByGame, gameEndMs, openCalls }`. Without autoplay, `play` is `null`.
- `report.js` adds METRICS rows that read `r.play`: `play fps`, `play frame p95 (ms)`, `play frame p99 (ms)`, `play jank frames (%)`, `play long tasks (ms)`, `play heap peak (MB)`, `play taps`, `time to game end (ms)` (`gameEndMs`, null if not reached). It adds a status row `games ended` with the count of runs where `endedByGame`. Rows whose metric has `n === 0` in every build are omitted, so the table without autoplay looks as before.
- CLI: add `--autoplay <bee-cube|file.json>` and `--play <ms>` (default 20000). Call `createTargetSource` before Chrome launches, so a bad tap script fails fast. The header prints `autoplay=<name> play=<ms>`.

- [ ] Step 1: report tests:
  - runs with `play` set → table contains `play fps` and `games ended`.
  - runs without `play` → table does not contain `play fps`.
- [ ] Step 2: `npm test` → FAIL. Step 3: implement. Step 4: `npm test` → PASS (all).
- [ ] Step 5: smoke run:
  `node cli.js "<CubeCheo applovin html>" --runs 1 --sample 0 --autoplay bee-cube --play 20000`
  Expected: `ok`, `play taps` > 0, and `play fps` reported. Check that taps land: `time to game end` is non-null **or** the number of top shooters changed during play. If taps never land, check the `toCssPoint` scale against `cc.view.getDevicePixelRatio()`, fix it, and add a test for the corrected formula.
- [ ] Step 6: commit `feat(perf-compare): autoplay play phase in run, report and CLI`.

## Verification

1. `cd scripts/perf-compare && npm test` → all pass.
2. A/A on bee-cube: copy the CubeCheo applovin HTML to two scratch paths, then `node cli.js a.html b.html --runs 4 --sample 0 --autoplay bee-cube`. Expect no `*` flags and `games ended` the same for both.
3. Real comparison: the user builds bee-cube with cocos-pnp at two obfuscation levels, then `node cli.js <low>.html <high>.html --runs 7 --autoplay bee-cube`. Report the play-phase deltas.
4. Regression: `node cli.js <TesOfu> <TesOfuMid> --runs 1 --sample 2000` (no autoplay) prints the old table with no play rows.
