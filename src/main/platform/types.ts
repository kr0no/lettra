import type { FontSource } from '@shared/types'

export interface FontRoot {
  source: FontSource
  dir: string
  removable: boolean
  /**
   * Optional filter on which subdirectories to enter. Used for large trees
   * (e.g. AssetsV2) where only some folders contain fonts.
   */
  descend?: (relativeDir: string) => boolean
  /** Watch this root for changes made outside Lettra. */
  watch: boolean
}

export interface Platform {
  fontRoots(): FontRoot[]
  /** Folder where Lettra installs fonts for the current user. */
  userFontsDir(): string
  revealInFileManager(path: string): void
  moveToTrash(path: string): Promise<void>
}
