import { open } from 'node:fs/promises'

/**
 * Rebuilds a standalone sfnt (TTF/OTF) for one face of a TrueType/OpenType
 * collection. Chromium's @font-face always uses face 0 of a .ttc, so each face is
 * served as its own file. Tables are copied, and the table directory is rewritten
 * with new offsets; shared tables are simply duplicated.
 */
export function extractCollectionFace(buf: Buffer, index: number): Buffer {
  if (buf.toString('latin1', 0, 4) !== 'ttcf') return buf
  const numFonts = buf.readUInt32BE(8)
  if (index < 0 || index >= numFonts) throw new RangeError(`face ${index} out of range (0-${numFonts - 1})`)

  const offset = buf.readUInt32BE(12 + 4 * index)
  const numTables = buf.readUInt16BE(offset + 4)
  const headerLength = 12 + 16 * numTables

  const records: { record: number; src: number; length: number }[] = []
  let total = headerLength
  for (let i = 0; i < numTables; i++) {
    const record = offset + 12 + 16 * i
    const length = buf.readUInt32BE(record + 12)
    records.push({ record, src: buf.readUInt32BE(record + 8), length })
    total += (length + 3) & ~3 // tables are 4-byte aligned
  }

  const out = Buffer.alloc(total)
  buf.copy(out, 0, offset, offset + 12) // sfnt version, numTables, searchRange, entrySelector, rangeShift
  let cursor = headerLength
  records.forEach(({ record, src, length }, i) => {
    const dst = 12 + 16 * i
    buf.copy(out, dst, record, record + 8) // tag + checksum
    out.writeUInt32BE(cursor, dst + 8)
    out.writeUInt32BE(length, dst + 12)
    buf.copy(out, cursor, src, src + length)
    cursor += pad4(length)
  })
  return out
}

const pad4 = (n: number): number => n + ((4 - (n % 4)) % 4)

/**
 * Reads one face straight from disk. Only the face's own tables are read, so a 190 MB
 * emoji collection doesn't get loaded whole for every preview. Plain font files are read as is.
 */
export async function readFace(path: string, index: number | null): Promise<Buffer> {
  const file = await open(path, 'r')
  try {
    const head = Buffer.alloc(12)
    await file.read(head, 0, 12, 0)
    if (index === null || head.toString('latin1', 0, 4) !== 'ttcf') return await file.readFile()

    const numFonts = head.readUInt32BE(8)
    if (index < 0 || index >= numFonts) throw new RangeError(`face ${index} out of range (0-${numFonts - 1})`)
    const at = async (position: number, length: number): Promise<Buffer> => {
      const buf = Buffer.alloc(length)
      const { bytesRead } = await file.read(buf, 0, length, position)
      if (bytesRead !== length) throw new Error(`${path} is truncated`)
      return buf
    }
    const { size } = await file.stat()
    const offset = (await at(12 + 4 * index, 4)).readUInt32BE(0)
    const header = await at(offset, 12)
    const numTables = header.readUInt16BE(4)
    const dir = await at(offset + 12, 16 * numTables)

    const headerLength = 12 + 16 * numTables
    let total = headerLength
    for (let i = 0; i < numTables; i++) {
      const src = dir.readUInt32BE(16 * i + 8)
      const length = dir.readUInt32BE(16 * i + 12)
      // Check against the file before allocating: a corrupt length could ask for gigabytes.
      if (src + length > size) throw new Error(`${path} is truncated`)
      total += pad4(length)
    }
    const out = Buffer.alloc(total)
    header.copy(out, 0)
    let cursor = headerLength
    for (let i = 0; i < numTables; i++) {
      const src = dir.readUInt32BE(16 * i + 8)
      const length = dir.readUInt32BE(16 * i + 12)
      dir.copy(out, 12 + 16 * i, 16 * i, 16 * i + 8) // tag + checksum
      out.writeUInt32BE(cursor, 12 + 16 * i + 8)
      out.writeUInt32BE(length, 12 + 16 * i + 12)
      const { bytesRead } = await file.read(out, cursor, length, src)
      if (bytesRead !== length) throw new Error(`${path} is truncated`)
      cursor += pad4(length)
    }
    return out
  } finally {
    await file.close()
  }
}
