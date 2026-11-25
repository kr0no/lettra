import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { loadWindowState, trackWindowState } from './window-state'

export function createMainWindow(): BrowserWindow {
  const saved = loadWindowState()
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    ...saved?.bounds,
    minWidth: 980,
    minHeight: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  trackWindowState(win)
  win.once('ready-to-show', () => {
    if (saved?.maximized) win.maximize()
    win.show()
  })

  // Never navigate away from the app or open new windows inside it.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  return win
}
