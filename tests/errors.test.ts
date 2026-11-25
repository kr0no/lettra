import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({ i18n: { t: (key: string) => key } }))
const { errorText } = await import('@/lib/errors')

const remote = (msg: string): Error => new Error(`Error invoking remote method 'gf:install': Error: ${msg}`)

describe('errorText', () => {
  it('strips the Electron wrapper', () => {
    expect(errorText(remote('Something broke'))).toBe('Something broke')
  })

  it('maps network failures', () => {
    for (const msg of [
      'fetch failed',
      'HTTP 503 for https://x',
      'HTTP 429 for https://x',
      'TimeoutError: x',
      'request timed out',
    ])
      expect(errorText(remote(msg))).toBe('errors.network')
    expect(errorText(remote('Lettra is in offline mode'))).toBe('errors.offline')
  })

  it('leaves client errors and font names alone', () => {
    for (const msg of [
      'HTTP 403 for https://www.googleapis.com/x',
      "Couldn't move '/Fonts/Sometime Outline.otf' to the Trash",
      'Downloaded file for Lifetime Outlined is not a valid font',
    ])
      expect(errorText(remote(msg))).toBe(msg)
  })
})
