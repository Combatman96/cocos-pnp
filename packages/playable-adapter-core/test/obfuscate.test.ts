import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  normalizeObfuscateRC,
  shouldObfuscateKey,
  buildObfuscatorOptions,
  obfuscateResMapper,
} from '../src/helpers/obfuscate.ts'

const scope = { include: [] as string[], exclude: [] as string[] }

test('obfuscates project bundles under assets/, skips engine and non-js', () => {
  // Project script bundles -> yes.
  assert.equal(shouldObfuscateKey('assets/main/index.js', scope), true)
  assert.equal(shouldObfuscateKey('assets/resources/index.js', scope), true)
  // Engine / loader / bootstrap -> no.
  assert.equal(shouldObfuscateKey('assets/internal/index.js', scope), false)
  assert.equal(shouldObfuscateKey('src/chunks/bundle.js', scope), false)
  assert.equal(shouldObfuscateKey('src/system.bundle.js', scope), false)
  assert.equal(shouldObfuscateKey('cocos-js/cc.js', scope), false)
  assert.equal(shouldObfuscateKey('application.js', scope), false)
  assert.equal(shouldObfuscateKey('index.js', scope), false)
  // Non-js resources -> no.
  assert.equal(shouldObfuscateKey('src/settings.json', scope), false)
  assert.equal(shouldObfuscateKey('assets/main/image.png', scope), false)
})

test('Windows-style backslash keys are normalized', () => {
  assert.equal(shouldObfuscateKey('assets\\main\\index.js', scope), true)
  assert.equal(shouldObfuscateKey('assets\\internal\\index.js', scope), false)
})

test('include/exclude override the default scope', () => {
  assert.equal(shouldObfuscateKey('src/game/logic.js', { include: ['src/game/'], exclude: [] }), true)
  assert.equal(shouldObfuscateKey('assets/main/index.js', { include: [], exclude: ['assets/main/'] }), false)
})

test('normalizeObfuscateRC enables by default and opts out on false', () => {
  assert.equal(normalizeObfuscateRC(undefined).enable, true)
  assert.equal(normalizeObfuscateRC(true).enable, true)
  assert.equal(normalizeObfuscateRC(false).enable, false)
  assert.equal(normalizeObfuscateRC({ enable: false }).enable, false)
  assert.equal(normalizeObfuscateRC({ controlFlowFlattening: true }).controlFlowFlattening, true)
})

test('buildObfuscatorOptions: max branch defaults all layers ON except debugProtection', () => {
  // feat/obfuscate-max defaults flatten + string array + dead code + self defending.
  const def = buildObfuscatorOptions({})
  assert.equal(def.controlFlowFlattening, true)
  assert.equal(def.controlFlowFlatteningThreshold, 0.75)
  assert.equal(def.stringArray, true)
  assert.equal(def.deadCodeInjection, true)
  assert.equal(def.selfDefending, true)
  assert.equal(def.debugProtection, false)
  assert.equal(def.sourceMap, false)

  // Explicit overrides still win.
  const off = buildObfuscatorOptions({
    controlFlowFlattening: false,
    stringArray: false,
    deadCodeInjection: false,
    selfDefending: false,
  })
  assert.equal(off.controlFlowFlattening, false)
  assert.equal(off.controlFlowFlatteningThreshold, 0)
  assert.equal(off.stringArray, false)
  assert.equal(off.deadCodeInjection, false)
  assert.equal(off.selfDefending, false)
})

const SAMPLE = `System.register("chunks:///_virtual/GameController.ts",["cc"],(function(exports){
  "use strict";
  var Component;
  function checkWin(score){ if (score >= 100){ return unlockReward(); } else { return continueGame(); } }
  function unlockReward(){ return "reward"; }
  function continueGame(){ return "continue"; }
  return { setters:[function(c){ Component = c.Component; }], execute:function(){ exports("checkWin", checkWin); } };
}));`

test('obfuscateResMapper only rewrites in-scope keys and keeps valid, linkable JS', () => {
  const resMapper: { [k: string]: string } = {
    'assets/main/index.js': SAMPLE,
    'assets/internal/index.js': SAMPLE,
    'src/system.bundle.js': SAMPLE,
    'src/settings.json': '{"a":1}',
  }
  const count = obfuscateResMapper(resMapper, undefined)

  assert.equal(count, 1, 'only assets/main/index.js is in scope')
  // Untouched entries are byte-identical.
  assert.equal(resMapper['assets/internal/index.js'], SAMPLE)
  assert.equal(resMapper['src/system.bundle.js'], SAMPLE)
  assert.equal(resMapper['src/settings.json'], '{"a":1}')

  const out = resMapper['assets/main/index.js']
  assert.notEqual(out, SAMPLE, 'in-scope file was transformed')
  // Local function names are gone.
  assert.ok(!out.includes('unlockReward'))
  // String array is on by default here, so the module id is no longer plaintext.
  assert.ok(!out.includes('chunks:///_virtual/GameController.ts'))
  // References System (module registration still happens, via decoded strings).
  assert.ok(out.includes('System'))
  // Output is syntactically valid.
  assert.doesNotThrow(() => new vm.Script(out))
})

test('obfuscate: false leaves every file untouched', () => {
  const resMapper = { 'assets/main/index.js': SAMPLE }
  const count = obfuscateResMapper(resMapper, false)
  assert.equal(count, 0)
  assert.equal(resMapper['assets/main/index.js'], SAMPLE)
})
