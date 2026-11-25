import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { GoogleCatalog } from './google/catalog'
import { GoogleInstaller } from './google/installer'
import { InstallManifest } from './google/manifest'
import { catchCrashes, log } from './log'
import { broadcast } from './ipc/typed'
import { registerIpc } from './ipc/register'
import { FontLibrary } from './local/font-library'
import { watchRoots } from './local/watcher'
import { setOffline } from './net/fetch'
import { platform } from './platform'
import { installMenu } from './menu'
import { handleFontProtocol, registerFontScheme } from './protocol/font-protocol'
import { LibraryStore } from './store/library'
import { SettingsStore } from './store/settings'
import { Updater } from './update/updater'
import { createMainWindow } from './window'

// Development runs keep their own data (and lock), so `pnpm dev` works next to an installed Lettra.
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'Lettra Dev'))
}

// A second copy would race this one on settings, library and installs.
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

catchCrashes()
registerFontScheme()

const roots = platform.fontRoots()
const library = new FontLibrary(roots)
const settings = new SettingsStore()
const catalog = new GoogleCatalog()
const manifest = new InstallManifest()
const favorites = new LibraryStore()
const installer = new GoogleInstaller(
  catalog,
  manifest,
  library,
  platform,
  (p) => broadcast('gf:installProgress', p),
  () => settings.get().googleApiKey,
)
const updater = new Updater((p) => broadcast('app:updateProgress', p))
let stopWatching: (() => void) | undefined

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return void createMainWindow()
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(async () => {
  log.info(`Lettra ${app.getVersion()} on macOS ${process.getSystemVersion()} (${process.arch})`)
  app.setAboutPanelOptions({
    applicationName: 'Lettra',
    applicationVersion: app.getVersion(),
    version: '',
    copyright: 'Copyright © 2026 kr0no (Aitor F.)',
    credits: 'Free software under the GPL-3.0 license.\ngithub.com/kr0no/lettra',
  })
  await Promise.all([settings.load(), manifest.load(), favorites.load()])
  setOffline(settings.get().offline)
  // The theme drives prefers-color-scheme in the window and the vibrancy/dialog appearance.
  nativeTheme.themeSource = settings.get().theme
  let language = settings.get().language
  settings.on('changed', (s) => {
    setOffline(s.offline)
    nativeTheme.themeSource = s.theme
    if (s.language !== language) installMenu((language = s.language))
  })
  const ownedByLettra = (path: string): boolean => manifest.owns(path)
  library.setOwnership(ownedByLettra)
  // Installs and uninstalls change which files are Lettra's: the next scan must not reuse old flags.
  manifest.on('changed', () => library.setOwnership(ownedByLettra))
  // Folders Lettra installed can be deleted in Finder; every rescan forgets those.
  library.on(
    'changed',
    () => void manifest.prune(existsSync).catch((error) => log.warn('manifest prune failed', error)),
  )

  handleFontProtocol(library)
  registerIpc({ library, settings, catalog, manifest, installer, favorites, updater })
  installMenu(language)

  // Before anything can start a scan: put back or drop folders an interrupted install left behind.
  await installer.cleanUp()

  // Show the window right away; the first scan fills it in (cached launches are near-instant).
  createMainWindow()
  stopWatching = watchRoots(roots, () => void library.ready().then(() => library.refresh()))
  void library.init().catch((error) => log.error('first font scan failed', error))
  void catalog.get().catch((error) => log.warn('catalog warm-up failed', error))

  // Once shortly after launch, then daily for people who leave Lettra open.
  const checkForUpdate = async (): Promise<void> => {
    if (!settings.get().checkUpdates) return
    const update = await updater.check()
    if (update) broadcast('app:updateAvailable', update)
  }
  void updater.cleanUp()
  setTimeout(() => void checkForUpdate(), 10_000)
  setInterval(() => void checkForUpdate(), 24 * 60 * 60_000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => stopWatching?.())
