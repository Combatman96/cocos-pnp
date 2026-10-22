import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { zipDirectory, zipFiles } from '../src/utils/zip.ts'

// Minimal reader: walks the central directory and verifies every entry's CRC.
const readZip = (zipPath: string) => {
  const buf = readFileSync(zipPath)
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.notEqual(eocd, -1, 'end of central directory record')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out: Record<string, Buffer> = {}
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataStart, dataStart + csize)
    const data = method === 8 ? inflateRawSync(raw) : raw
    assert.equal(crcOf(data), crc, `crc of ${name}`)
    out[name] = data
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

const crcOf = (data: Buffer) => {
  let c = ~0
  for (const b of data) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

const tmp = () => mkdtempSync(join(tmpdir(), 'pnp-zip-'))

test('zipDirectory stores files relative to the folder root with forward slashes', () => {
  const dir = tmp()
  const src = join(dir, 'src')
  mkdirSync(join(src, 'js'), { recursive: true })
  writeFileSync(join(src, 'index.html'), '<html>héllo</html>')
  writeFileSync(join(src, 'config.json'), '{"a":1}')
  writeFileSync(join(src, 'js', 'index0.js'), 'x'.repeat(5000))
  const zip = join(dir, 'out.zip')

  zipDirectory(src, zip)

  const entries = readZip(zip)
  assert.deepEqual(Object.keys(entries).sort(), ['config.json', 'index.html', 'js/index0.js'])
  assert.equal(entries['index.html'].toString('utf8'), '<html>héllo</html>')
  assert.equal(entries['js/index0.js'].length, 5000)
  rmSync(dir, { recursive: true, force: true })
})

test('zipFiles writes the given buffers under the given names', () => {
  const dir = tmp()
  const zip = join(dir, 'single.zip')

  zipFiles(zip, [{ name: 'index.html', data: Buffer.from('<p>hi</p>') }])

  assert.deepEqual(Object.keys(readZip(zip)), ['index.html'])
  rmSync(dir, { recursive: true, force: true })
})

test('zipDirectory can nest everything in a folder and rename index.html', () => {
  const dir = tmp()
  const src = join(dir, 'src')
  mkdirSync(join(src, 'js'), { recursive: true })
  writeFileSync(join(src, 'index.html'), '<p>hi</p>')
  writeFileSync(join(src, 'js', 'index0.js'), 'x')
  const zip = join(dir, 'out.zip')

  zipDirectory(src, zip, { folder: 'myGame', rename: { 'index.html': 'myGame.html' } })

  assert.deepEqual(Object.keys(readZip(zip)).sort(), ['myGame/js/index0.js', 'myGame/myGame.html'])
  rmSync(dir, { recursive: true, force: true })
})
