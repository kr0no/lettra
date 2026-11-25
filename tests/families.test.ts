import { describe, expect, it } from 'vitest'
import { inSection, matches, representative, visibleFaces } from '@/lib/families'
import { face, family } from './fixtures'

describe('matches', () => {
  const fam = family(
    [
      face({
        familyName: 'Helvética Neue',
        styleName: 'Condensed Bold',
        postscriptName: 'HelveticaNeue-CondensedBold',
      }),
    ],
    { name: 'Helvética Neue' },
  )

  it('ignores case and accents', () => {
    expect(matches(fam, 'helvetica')).toBe(true)
    expect(matches(fam, 'HELVÉTICA')).toBe(true)
  })

  it('finds style and PostScript names', () => {
    expect(matches(fam, 'condensed bold')).toBe(true)
    expect(matches(fam, 'neue-condensed')).toBe(true)
  })

  it('treats an empty query as a match and rejects unrelated text', () => {
    expect(matches(fam, '   ')).toBe(true)
    expect(matches(fam, 'garamond')).toBe(false)
  })
})

describe('visibleFaces', () => {
  it('hides dot-prefixed system faces', () => {
    const shown = face({ id: 'a' })
    expect(visibleFaces(family([shown, face({ id: 'b', hiddenSystemFont: true })]))).toEqual([shown])
  })

  it('keeps them when there is nothing else to show', () => {
    const only = face({ hiddenSystemFont: true })
    expect(visibleFaces(family([only]))).toEqual([only])
  })
})

describe('representative', () => {
  it('prefers an upright, normal-width Regular', () => {
    const regular = face({ id: 'r' })
    const faces = [
      face({ id: 'b', weight: 700 }),
      face({ id: 'i', italic: true }),
      face({ id: 'c', width: 3 }),
      regular,
    ]
    expect(representative(family(faces))?.id).toBe('r')
  })

  it('falls back to the closest face', () => {
    const faces = [face({ id: 'thin', weight: 100 }), face({ id: 'medium', weight: 500 })]
    expect(representative(family(faces))?.id).toBe('medium')
  })

  it('returns undefined for a family without faces', () => {
    expect(representative(family([]))).toBeUndefined()
  })
})

describe('inSection', () => {
  const user = family([], { sources: ['user'] })
  const both = family([], { sources: ['user', 'system'] })
  const asset = family([], { sources: ['apple-asset'] })

  it('splits user and system fonts', () => {
    expect(inSection(user, 'user')).toBe(true)
    expect(inSection(user, 'system')).toBe(false)
    expect(inSection(both, 'system')).toBe(true)
    expect(inSection(asset, 'system')).toBe(true)
    expect(inSection(asset, 'all')).toBe(true)
  })
})
