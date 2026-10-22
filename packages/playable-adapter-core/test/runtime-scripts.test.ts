import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { buildRuntimeScript, RUNTIME_CHANNELS } from '../src/channels/runtime-scripts.ts'

// Evaluates the injected <script> in a bare window (no network SDK present).
const run = (html: string, extra: Record<string, unknown> = {}, userAgent = 'iPhone') => {
  const code = html.replace(/^<script>/, '').replace(/<\/script>$/, '')
  const win: any = {
    navigator: { userAgent },
    console: { log() {}, error() {} },
    addEventListener(type: string, fn: () => void) { (win.__listeners[type] ||= []).push(fn) },
    __listeners: {} as Record<string, Array<() => void>>,
    open() {},
    ...extra,
  }
  win.window = win
  vm.runInNewContext(code, win)
  return win
}

for (const channel of RUNTIME_CHANNELS) {
  test(`${channel}: super_html API is safe to call without a network SDK`, () => {
    const win = run(buildRuntimeScript(channel, false))
    assert.equal(typeof win.super_html.download, 'function')
    assert.equal(typeof win.super_html.game_ready, 'function')
    assert.equal(typeof win.super_html.game_end, 'function')
    assert.equal(win.super_html.is_hide_download(), false)
    win.super_html.download()
    win.super_html.game_ready()
    win.super_html.game_end()
  })

  test(`${channel}: .adapterrc channel config replaces the default script`, () => {
    assert.equal(buildRuntimeScript(channel, true), '')
  })
}

test('Mintegral: game_end forwards to window.gameEnd', () => {
  let ended = 0
  const win = run(buildRuntimeScript('Mintegral', false), { gameEnd: () => ended++ })
  win.super_html.game_end()
  assert.equal(ended, 1)
})

test('Unity: download opens the Google Play url on Android', () => {
  const opened: string[] = []
  const win = run(buildRuntimeScript('Unity', false), { mraid: { open: (u: string) => opened.push(u) } }, 'Android')
  win.super_html.google_play_url = 'https://play.google.com/x'
  win.super_html.appstore_url = 'https://apps.apple.com/x'
  win.super_html.download()
  assert.deepEqual(opened, ['https://play.google.com/x'])
})

test('Pangle: download calls openAppStore exactly once', () => {
  let calls = 0
  const win = run(buildRuntimeScript('Pangle', false), { openAppStore: () => { calls++; return true } })
  win.super_html.download()
  assert.equal(calls, 1)
})

test('Mintegral: defines the gameStart and gameClose callbacks the platform calls', () => {
  const win = run(buildRuntimeScript('Mintegral', false))
  assert.equal(typeof win.gameStart, 'function')
  assert.equal(typeof win.gameClose, 'function')
  win.gameStart()
  win.gameClose()
})

test('Mintegral: gameReady is reported automatically once the page loads', () => {
  let ready = 0
  const win = run(buildRuntimeScript('Mintegral', false), { gameReady: () => ready++ })
  assert.equal(ready, 0)
  win.__listeners.load.forEach((fn: () => void) => fn())
  assert.equal(ready, 1)
})

test('game_ready only reports once even when the game calls it as well', () => {
  let ready = 0
  const win = run(buildRuntimeScript('Mintegral', false), { gameReady: () => ready++ })
  win.super_html.game_ready()
  win.__listeners.load.forEach((fn: () => void) => fn())
  win.super_html.game_ready()
  assert.equal(ready, 1)
})

test('Mintegral: game_retry forwards to window.gameRetry', () => {
  let retried = 0
  const win = run(buildRuntimeScript('Mintegral', false), { gameRetry: () => retried++ })
  win.super_html.game_retry()
  assert.equal(retried, 1)
})

test('Unity: waits for the MRAID ready event while mraid is loading', () => {
  const listeners: Record<string, Array<() => void>> = {}
  const mraid = {
    getState: () => 'loading',
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn) },
    isViewable: () => true,
    open() {},
  }
  const win = run(buildRuntimeScript('Unity', false), { mraid })
  win.__listeners.load.forEach((fn: () => void) => fn())
  assert.equal(listeners.ready?.length, 1)
  assert.equal(listeners.viewableChange, undefined)
  listeners.ready[0]()
  assert.equal(listeners.viewableChange?.length, 1)
})

test('Unity: skips the ready wait when mraid is already initialised', () => {
  const listeners: Record<string, Array<() => void>> = {}
  const mraid = {
    getState: () => 'default',
    addEventListener: (type: string, fn: () => void) => { (listeners[type] ||= []).push(fn) },
    isViewable: () => true,
    open() {},
  }
  const win = run(buildRuntimeScript('Unity', false), { mraid })
  win.__listeners.load.forEach((fn: () => void) => fn())
  assert.equal(listeners.ready, undefined)
  assert.equal(listeners.viewableChange?.length, 1)
})

test('Unity: registers resize and orientationchange handlers', () => {
  const win = run(buildRuntimeScript('Unity', false))
  assert.ok(win.__listeners.resize?.length >= 1)
  assert.ok(win.__listeners.orientationchange?.length >= 1)
})
