import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractStoreUrls, buildStoreComments } from '../src/channels/unity/store-urls.ts'

const PLAY = 'https://play.google.com/store/apps/details?id=com.ig.fish.up.match'
const APPLE = 'https://apps.apple.com/us/app/ad-testing/id1463016906'

test('finds the Play Store and App Store urls in script text', () => {
  const resources = {
    'a.js': `var a="${PLAY}";var b='${APPLE}';`,
    'b.js': 'nothing here',
  }
  assert.deepEqual(extractStoreUrls(Object.values(resources)), [PLAY, APPLE])
})

test('accepts a bare apps.apple.com url', () => {
  assert.deepEqual(extractStoreUrls(['x="https://apps.apple.com"']), ['https://apps.apple.com'])
})

test('reports each url once and skips data: resources', () => {
  assert.deepEqual(extractStoreUrls([`${PLAY} ${PLAY}`, `data:image/png;base64,${PLAY}`]), [PLAY])
})

test('returns nothing when no store url exists', () => {
  assert.deepEqual(extractStoreUrls(['console.log(1)']), [])
})

test('renders html comments and escapes double dashes', () => {
  assert.equal(buildStoreComments([PLAY, 'https://apps.apple.com/a--b']), `<!-- ${PLAY} -->\n<!-- https://apps.apple.com/a%2D%2Db -->`)
  assert.equal(buildStoreComments([]), '')
})
