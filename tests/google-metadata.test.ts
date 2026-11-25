import { describe, expect, it } from 'vitest'
import { compareVariants, parseMetadata } from '../src/main/google/metadata-source'

const raw = {
  axisRegistry: [{ tag: 'wght', displayName: 'Weight' }],
  familyMetadataList: [
    {
      family: 'Noto Sans JP',
      category: 'Sans Serif',
      fonts: { '700': {}, '400': {}, '400i': {}, '100': {} },
      axes: [{ tag: 'wght', min: 100, max: 900, defaultValue: 400 }],
      subsets: ['menu', 'japanese', 'latin'],
      primaryScript: 'Jpan',
      designers: ['Google'],
      popularity: 8,
    },
    { family: 'Odd One', category: 'Something New', fonts: { '400': {} } },
  ],
}

describe('parseMetadata', () => {
  const [noto, odd] = parseMetadata(JSON.stringify(raw))

  it('maps the fields Lettra uses', () => {
    expect(noto).toMatchObject({
      key: 'noto sans jp',
      family: 'Noto Sans JP',
      category: 'sans-serif',
      primaryScript: 'Jpan',
      designers: ['Google'],
      popularity: 8,
    })
  })

  it('sorts variants upright first, then by weight', () => {
    expect(noto!.variants).toEqual(['100', '400', '700', '400i'])
  })

  it("drops Google's internal menu subset and names axes", () => {
    expect(noto!.subsets).toEqual(['japanese', 'latin'])
    expect(noto!.axes).toEqual([{ tag: 'wght', name: 'Weight', min: 100, max: 900, default: 400 }])
  })

  it('falls back for missing fields and unknown categories', () => {
    expect(odd).toMatchObject({
      category: 'display',
      subsets: [],
      axes: [],
      designers: [],
      primaryScript: '',
    })
    expect(odd!.popularity).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('strips the old XSSI guard if it comes back', () => {
    expect(parseMetadata(`)]}'\n${JSON.stringify(raw)}`)).toHaveLength(2)
  })
})

describe('compareVariants', () => {
  it('orders weights numerically, not as strings', () => {
    expect(['900', '100', '1000'].sort(compareVariants)).toEqual(['100', '900', '1000'])
  })
})

describe('parseMetadata with bad entries', () => {
  it('skips entries without a name or fonts instead of failing', () => {
    const json = JSON.stringify({
      familyMetadataList: [
        { family: 'Good', category: 'Serif', fonts: { '400': {} } },
        { category: 'Serif' },
        null,
      ],
    })
    expect(parseMetadata(json).map((f) => f.family)).toEqual(['Good'])
  })
})
