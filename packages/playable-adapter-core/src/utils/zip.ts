import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, relative, sep } from 'path'
import { deflateRawSync } from 'zlib'

// Minimal ZIP writer (deflate, no zip64), so no archive dependency ships in
// the editor extension.
type TZipEntry = { name: string, data: Buffer }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (data: Buffer) => {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const UTF8_FLAG = 0x0800

export const zipFiles = (zipPath: string, entries: TZipEntry[]) => {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const compressed = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_FLAG, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    chunks.push(local, nameBuf, compressed)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(UTF8_FLAG, 8)
    header.writeUInt16LE(8, 10)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(compressed.length, 20)
    header.writeUInt32LE(data.length, 24)
    header.writeUInt16LE(nameBuf.length, 28)
    header.writeUInt32LE(offset, 42)
    central.push(header, nameBuf)

    offset += local.length + nameBuf.length + compressed.length
  }

  const centralSize = central.reduce((sum, b) => sum + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)

  writeFileSync(zipPath, Buffer.concat([...chunks, ...central, end]))
}

const listFiles = (dir: string): string[] =>
  readdirSync(dir).sort().flatMap((file) => {
    const full = join(dir, file)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })

// Zips the folder's contents (not the folder itself), so `index.html` sits at
// the archive root.
// `folder` nests every entry under that folder; `rename` maps an entry path to a new one.
export const zipDirectory = (dir: string, zipPath: string, options: { folder?: string, rename?: Record<string, string> } = {}) => {
  const { folder, rename = {} } = options
  zipFiles(zipPath, listFiles(dir).map((file) => {
    const path = relative(dir, file).split(sep).join('/')
    const name = rename[path] ?? path
    return { name: folder ? `${folder}/${name}` : name, data: readFileSync(file) }
  }))
}
