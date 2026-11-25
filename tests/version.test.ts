import { describe, expect, it } from 'vitest'
import { isNewer } from '../src/main/update/version'

describe('isNewer', () => {
  it('compares each part as a number', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('1.10.0', '1.9.9')).toBe(true)
    expect(isNewer('2.0.0', '1.99.99')).toBe(true)
  })

  it('is false for the same or an older version', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('1.0.0', '1.0.1')).toBe(false)
    expect(isNewer('0.9.0', '1.0.0')).toBe(false)
  })

  it('handles a v prefix, missing parts and suffixes', () => {
    expect(isNewer('v1.2.0', '1.1.0')).toBe(true)
    expect(isNewer('1.1', '1.1.0')).toBe(false)
    expect(isNewer('1.2.0-beta.1', '1.1.0')).toBe(true)
    expect(isNewer('1.1.0-beta.1', '1.1.0')).toBe(false)
  })
})
