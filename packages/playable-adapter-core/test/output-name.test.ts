import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getChannelOutputName, getBuildNameFromHtml, getOutputFolderName } from '../src/utils/output-name.ts'

test('prefixes the channel with the build name', () => {
  assert.equal(getChannelOutputName('Pangle', 'iGHQ_PAIH_101RevserseAll'), 'iGHQ_PAIH_101RevserseAll_Pangle')
})

test('falls back to the channel when there is no build name', () => {
  assert.equal(getChannelOutputName('Unity', undefined), 'Unity')
  assert.equal(getChannelOutputName('Unity', '   '), 'Unity')
})

test('replaces characters that are illegal in file names', () => {
  assert.equal(getChannelOutputName('Google', 'a/b:c*d?"e<f>g|h\\i'), 'a_b_c_d__e_f_g_h_i_Google')
})

test('trims surrounding whitespace and dots of the build name', () => {
  assert.equal(getChannelOutputName('Google', '  My Game. '), 'My Game_Google')
})

test('reads the build name from the built index.html title', () => {
  assert.equal(getBuildNameFromHtml('<html><head><title>Cocos Creator | My Game</title></head></html>'), 'My Game')
  assert.equal(getBuildNameFromHtml('<title>Plain</title>'), 'Plain')
  assert.equal(getBuildNameFromHtml('<html></html>'), undefined)
})

test('strict names keep only letters, digits and underscores (Mintegral)', () => {
  assert.equal(getChannelOutputName('Mintegral', 'My Game-v1.2', true), 'My_Game_v1_2_Mintegral')
  assert.equal(getChannelOutputName('Mintegral', 'iGHQ_PAIH_101RevserseAll', true), 'iGHQ_PAIH_101RevserseAll_Mintegral')
  assert.equal(getChannelOutputName('Mintegral', undefined, true), 'Mintegral')
})

test('groups every channel output in a folder named after the build', () => {
  assert.equal(getOutputFolderName('iGHQ_PAIH_101RevserseAll'), 'iGHQ_PAIH_101RevserseAll')
  assert.equal(getOutputFolderName('My/Game: 1'), 'My_Game_ 1')
  assert.equal(getOutputFolderName(undefined), 'playable')
  assert.equal(getOutputFolderName('  '), 'playable')
})
