import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'
import type { Platform } from './types'

const userFonts = join(homedir(), 'Library/Fonts')

export const darwin: Platform = {
  fontRoots: () => [
    { source: 'user', dir: userFonts, removable: true, watch: true },
    { source: 'local', dir: '/Library/Fonts', removable: false, watch: true },
    { source: 'system', dir: '/System/Library/Fonts', removable: false, watch: false },
    {
      // macOS 26+ keeps Apple's preinstalled/downloadable fonts here, e.g.
      // PreinstalledAssetsV2/InstallWithOs/com_apple_MobileAsset_Font7/<hash>.asset/AssetData/*.ttc
      source: 'apple-asset',
      dir: '/System/Library/AssetsV2',
      removable: false,
      watch: false,
      // Enter container folders, then only the font asset types (skip ML models, voices...).
      descend: (rel) => {
        const segments = rel.split('/')
        const asset = segments.find((s) => s.startsWith('com_apple_MobileAsset_'))
        return asset ? asset.startsWith('com_apple_MobileAsset_Font') : segments.length <= 2
      },
    },
  ],
  userFontsDir: () => userFonts,
  revealInFileManager: (path) => shell.showItemInFolder(path),
  moveToTrash: (path) => shell.trashItem(path),
}
