import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getOrientationMeta } from '../src/channels/google/inject-vars.ts'

for (const orientation of ['landscape', 'portrait', 'auto'] as const) {
  test(`Google ad.orientation is "portrait,landscape" for ${orientation} builds`, () => {
    const meta = getOrientationMeta(orientation)
    assert.match(meta, /<meta name="ad\.orientation" content="portrait,landscape">/)
    assert.equal(meta.match(/ad\.orientation/g)?.length, 1)
  })
}

test('keeps the ad.size meta matching the build orientation', () => {
  assert.match(getOrientationMeta('landscape'), /width=480,height=320/)
  assert.match(getOrientationMeta('portrait'), /width=320,height=480/)
})
