import { describe, expect, it } from 'vitest'
import { familyKey } from '@shared/family-key'
import { methodName } from '@shared/ipc-contract'
import { defaultVariant } from '@/lib/google-loader'
import { googleSample } from '@/lib/sample-text'
import { groupByBlock } from '@/lib/unicode-blocks'
import { google } from './fixtures'

describe('familyKey', () => {
  it('normalizes case, spacing and Unicode form', () => {
    expect(familyKey('  Noto   Sans  JP ')).toBe('noto sans jp')
    expect(familyKey('Ｉｎｔｅｒ')).toBe('inter')
  })
})

describe('methodName', () => {
  it('turns channels into window.fontAPI method names', () => {
    expect(methodName('fonts:list')).toBe('fontsList')
    expect(methodName('app:updateCheck')).toBe('appUpdateCheck')
  })
})

describe('googleSample', () => {
  it('uses a native sample for CJK and non-Latin families', () => {
    expect(googleSample(google({ primaryScript: 'Jpan', subsets: ['japanese', 'latin'] }), 'Hello')).not.toBe(
      'Hello',
    )
    expect(googleSample(google({ primaryScript: 'Thai', subsets: ['thai'] }), 'Hello')).not.toBe('Hello')
  })

  it("keeps the user's text for Latin families that cover another script", () => {
    expect(googleSample(google({ primaryScript: 'Deva', subsets: ['devanagari', 'latin'] }), 'Hello')).toBe(
      'Hello',
    )
  })

  it('uses a subset sample when there is no primary script', () => {
    expect(googleSample(google({ primaryScript: '', subsets: ['emoji'] }), 'Hello')).not.toBe('Hello')
    expect(googleSample(google({ primaryScript: '', subsets: ['khmer'] }), 'Hello')).not.toBe('Hello')
    expect(googleSample(google({ primaryScript: '', subsets: [] }), 'Hello')).toBe('Hello')
  })

  it('falls back to the family name', () => {
    expect(googleSample(google(), '')).toBe('Inter')
  })
})

describe('defaultVariant', () => {
  it('prefers 400, then the closest upright weight', () => {
    expect(defaultVariant(google({ variants: ['300', '400', '700'] }))).toBe('400')
    expect(defaultVariant(google({ variants: ['300i', '500', '900'] }))).toBe('500')
    expect(defaultVariant(google({ variants: ['300i', '700i'] }))).toBe('300i')
  })
})

describe('groupByBlock', () => {
  const groups = groupByBlock([0x00, 0x41, 0x42, 0xe9, 0x0410, 0x2c00, 0x10fff0])

  it('skips invisible characters and groups by block in order', () => {
    expect(groups.map((g) => g.name)).toEqual(['Basic Latin', 'Latin-1 Supplement', 'Cyrillic', null])
    expect(groups[0]!.codePoints).toEqual([0x41, 0x42])
  })

  it('puts everything outside known blocks in one trailing "Other" group', () => {
    expect(groups.at(-1)!.codePoints).toEqual([0x2c00, 0x10fff0])
  })
})
