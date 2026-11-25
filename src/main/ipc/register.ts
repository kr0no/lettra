import type { InstallMode, UninstallTarget } from '@shared/types'
import type { GoogleCatalog } from '../google/catalog'
import { previewFaces } from '../google/css2'
import { repoFamily } from '../google/github'
import type { GoogleInstaller } from '../google/installer'
import type { InstallManifest } from '../google/manifest'
import type { FontLibrary } from '../local/font-library'
import { installFiles } from '../local/install-files'
import { planUninstall, uninstall } from '../local/uninstall'
import { log } from '../log'
import { platform } from '../platform'
import type { LibraryStore } from '../store/library'
import type { SettingsStore } from '../store/settings'
import type { Updater } from '../update/updater'
import { assertString, broadcast, handle } from './typed'

interface Services {
  library: FontLibrary
  settings: SettingsStore
  catalog: GoogleCatalog
  manifest: InstallManifest
  installer: GoogleInstaller
  favorites: LibraryStore
  updater: Updater
}

function assertTarget(value: unknown): asserts value is UninstallTarget {
  const t = value as UninstallTarget | null
  const ok =
    t !== null &&
    typeof t === 'object' &&
    (('familyKey' in t && typeof t.familyKey === 'string') ||
      ('faceIds' in t && Array.isArray(t.faceIds) && t.faceIds.every((id) => typeof id === 'string')))
  if (!ok) throw new TypeError('invalid uninstall target')
}

function assertMode(value: unknown): asserts value is InstallMode {
  if (value !== 'static' && value !== 'variable') throw new TypeError('mode must be static or variable')
}

const assertKeys = (keys: unknown): string[] => {
  if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string'))
    throw new TypeError('keys must be strings')
  return keys
}

export function registerIpc({
  library,
  settings,
  catalog,
  manifest,
  installer,
  favorites,
  updater,
}: Services): void {
  handle('fonts:list', async () => {
    await library.ready()
    return library.list()
  })
  handle('fonts:rescan', async () => {
    await library.refresh()
    return library.list()
  })
  handle('fonts:status', () => library.getStatus())
  handle('fonts:coverage', (faceId) => {
    assertString(faceId, 'faceId')
    return library.codePoints(faceId)
  })
  handle('fonts:reveal', (faceId) => {
    assertString(faceId, 'faceId')
    const face = library.face(faceId)
    if (face) platform.revealInFileManager(face.filePath)
  })
  handle('fonts:uninstallPlan', (target) => {
    assertTarget(target)
    return planUninstall(library, platform, target)
  })
  handle('fonts:uninstall', async (target) => {
    assertTarget(target)
    await uninstall(library, platform, target)
    await library.refresh() // prunes the manifest too, see index.ts
  })

  handle('fonts:installFiles', async (paths) => {
    const result = await installFiles(platform, assertKeys(paths))
    if (result.installed.length) await library.refresh()
    return result
  })

  handle('library:get', () => favorites.get())
  handle('library:toggleFavorite', (key) => {
    assertString(key, 'key')
    return favorites.toggleFavorite(key)
  })
  handle('library:collectionCreate', (name, keys) => {
    assertString(name, 'name')
    return favorites.create(name, assertKeys(keys))
  })
  handle('library:collectionRename', (id, name) => {
    assertString(id, 'id')
    assertString(name, 'name')
    return favorites.rename(id, name)
  })
  handle('library:collectionDelete', (id) => {
    assertString(id, 'id')
    return favorites.delete(id)
  })
  handle('library:collectionAdd', (id, keys) => {
    assertString(id, 'id')
    return favorites.add(id, assertKeys(keys))
  })
  handle('library:collectionRemove', (id, keys) => {
    assertString(id, 'id')
    return favorites.remove(id, assertKeys(keys))
  })

  handle('gf:catalog', (options) => catalog.get({ refresh: Boolean(options?.refresh) }))
  handle('gf:previewFaces', async (family, variant) => {
    assertString(family, 'family')
    assertString(variant, 'variant')
    await catalog.get()
    const f = catalog.family(family)
    if (!f) throw new Error(`Unknown family ${family}`)
    return previewFaces(f, variant)
  })
  handle('gf:info', async (family) => {
    assertString(family, 'family')
    const { license, variableFiles } = await repoFamily(family)
    return { license, variableFiles }
  })
  handle('gf:installed', () => manifest.list())
  handle('gf:installPlan', (family, mode) => {
    assertString(family, 'family')
    assertMode(mode)
    return installer.plan(family, mode)
  })
  handle('gf:install', (family, mode, choice) => {
    assertString(family, 'family')
    assertMode(mode)
    if (!['cancel', 'install-anyway', 'replace'].includes(choice)) throw new TypeError('invalid choice')
    return installer.install(family, mode, choice)
  })
  handle('gf:uninstall', (family) => {
    assertString(family, 'family')
    return installer.uninstall(family)
  })
  handle('gf:updates', () => installer.updates())

  handle('settings:get', () => settings.get())
  handle('settings:set', (patch) => {
    if (typeof patch !== 'object' || patch === null) throw new TypeError('patch must be an object')
    return settings.set(patch)
  })

  handle('app:updateCheck', (force) => (force ? updater.check(true) : updater.current()))
  handle('app:updateDownload', () => updater.download())
  handle('app:updateInstall', () => updater.install())

  handle('app:logError', (message, stack) => {
    log.error(`renderer: ${String(message).slice(0, 500)}\n${String(stack).slice(0, 4000)}`)
  })

  library.on('changed', () => broadcast('fonts:changed', undefined))
  library.on('status', (status) => broadcast('fonts:status', status))
  settings.on('changed', (value) => broadcast('settings:changed', value))
  manifest.on('changed', (records) => broadcast('gf:installedChanged', records))
  favorites.on('changed', (value) => broadcast('library:changed', value))
}
