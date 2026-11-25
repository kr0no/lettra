import type { Settings } from './types'

export const DEFAULT_PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog'

export const DEFAULT_SETTINGS: Settings = {
  language: 'system',
  theme: 'system',
  installMode: 'static',
  offline: false,
  checkUpdates: true,
  preview: { text: DEFAULT_PREVIEW_TEXT, size: 32, view: 'grid' },
}

export const PREVIEW_SIZE = { min: 14, max: 72 } as const
export const MAX_PREVIEW_TEXT = 500
