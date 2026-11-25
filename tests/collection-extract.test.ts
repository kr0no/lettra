import { existsSync, readFileSync } from 'node:fs'
import { create, type FontkitCollection, type FontkitFont } from 'fontkit'
import { describe, expect, it } from 'vitest'
import { extractCollectionFace, readFace } from '../src/main/local/collection-extract'

const TTC = '/System/Library/Fonts/Helvetica.ttc'

describe.runIf(existsSync(TTC))('extractCollectionFace', () => {
  const bytes = readFileSync(TTC)
  const collection = create(bytes) as FontkitCollection

  it('turns each face of a .ttc into a standalone font', () => {
    collection.fonts.forEach((original: FontkitFont, index: number) => {
      const single = create(extractCollectionFace(bytes, index)) as FontkitFont
      expect(single.postscriptName).toBe(original.postscriptName)
      expect(single.numGlyphs).toBe(original.numGlyphs)
    })
  })

  it('rejects an index outside the collection', () => {
    expect(() => extractCollectionFace(bytes, collection.fonts.length)).toThrow(RangeError)
  })
})

describe.runIf(existsSync(TTC))('readFace', () => {
  const bytes = readFileSync(TTC)
  const count = (create(bytes) as FontkitCollection).fonts.length

  it('reads the same bytes as cutting the face out of the whole file', async () => {
    for (let i = 0; i < count; i++) {
      expect((await readFace(TTC, i)).equals(extractCollectionFace(bytes, i))).toBe(true)
    }
  })

  it('returns plain font files untouched', async () => {
    const single = '/System/Library/Fonts/Supplemental/Arial.ttf'
    if (existsSync(single)) expect((await readFace(single, null)).equals(readFileSync(single))).toBe(true)
  })
})

describe('readFace on a corrupt collection', () => {
  it('rejects a table length past the end of the file without allocating it', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    // ttcf header, one font at offset 16, one table claiming 2 GB.
    const buf = Buffer.alloc(16 + 12 + 16)
    buf.write('ttcf', 0, 'latin1')
    buf.writeUInt32BE(1, 8)
    buf.writeUInt32BE(16, 12)
    buf.writeUInt32BE(0x00010000, 16)
    buf.writeUInt16BE(1, 20)
    buf.write('glyf', 28, 'latin1')
    buf.writeUInt32BE(44, 36)
    buf.writeUInt32BE(0x7fff_fff0, 40)
    const path = join(await mkdtemp(join(tmpdir(), 'lettra-')), 'bad.ttc')
    await writeFile(path, buf)
    await expect(readFace(path, 0)).rejects.toThrow(/truncated/)
  })
})

describe.runIf(existsSync(TTC))('face size from the parser', () => {
  it('matches the bytes actually served for each face', async () => {
    const { parseFontFile } = await import('../src/main/local/parser')
    const parsed = parseFontFile(TTC, 0, 0)
    for (const face of parsed.faces) {
      expect(face.bytes).toBe((await readFace(TTC, face.collectionIndex)).length)
    }
  })
})
