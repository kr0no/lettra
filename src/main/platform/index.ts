import { darwin } from './darwin'
import type { Platform } from './types'

export type { FontRoot, Platform } from './types'

function select(): Platform {
  switch (process.platform) {
    case 'darwin':
      return darwin
    default:
      throw new Error(`Lettra only runs on macOS (got ${process.platform})`)
  }
}

export const platform: Platform = select()
