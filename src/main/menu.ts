import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, Menu, shell, systemPreferences, type MenuItemConstructorOptions } from 'electron'
import type { AppCommand, Language } from '@shared/types'
import { broadcast } from './ipc/typed'
import { logDir } from './log'

const REPO = 'https://github.com/kr0no/lettra'

// Electron's role menus come out in English whatever the system language, so every label is set
// here. Only what Lettra uses: no Format menu, no Speech or Paste and Match Style.
const LABELS = {
  en: {
    about: 'About Lettra',
    settings: 'Settings…',
    services: 'Services',
    hide: 'Hide Lettra',
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quit: 'Quit Lettra',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    grid: 'as Grid',
    list: 'as List',
    find: 'Find',
    fullScreen: 'Toggle Full Screen',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    front: 'Bring All to Front',
    help: 'Help',
    github: 'Lettra on GitHub',
    issue: 'Report an Issue…',
    logs: 'Show Logs',
    licenses: 'Third-Party Licenses',
  },
  es: {
    about: 'Acerca de Lettra',
    settings: 'Ajustes…',
    services: 'Servicios',
    hide: 'Ocultar Lettra',
    hideOthers: 'Ocultar otros',
    showAll: 'Mostrar todo',
    quit: 'Salir de Lettra',
    edit: 'Edición',
    undo: 'Deshacer',
    redo: 'Rehacer',
    cut: 'Cortar',
    copy: 'Copiar',
    paste: 'Pegar',
    selectAll: 'Seleccionar todo',
    view: 'Visualización',
    grid: 'como cuadrícula',
    list: 'como lista',
    find: 'Buscar',
    fullScreen: 'Pantalla completa',
    window: 'Ventana',
    minimize: 'Minimizar',
    zoom: 'Zoom',
    front: 'Traer todo al frente',
    help: 'Ayuda',
    github: 'Lettra en GitHub',
    issue: 'Informar de un problema…',
    logs: 'Mostrar registros',
    licenses: 'Licencias de terceros',
  },
}

export const noticesPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'THIRD_PARTY_NOTICES.txt')
    : join(app.getAppPath(), 'out', 'THIRD_PARTY_NOTICES.txt')

const send = (command: AppCommand) => () => broadcast('app:command', command)

function resolve(language: Language): keyof typeof LABELS {
  if (language !== 'system') return language
  return app.getPreferredSystemLanguages()[0]?.startsWith('es') ? 'es' : 'en'
}

export function installMenu(language: Language): void {
  // macOS adds Start Dictation to any Edit menu; it's no use here.
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true)
  const l = LABELS[resolve(language)]
  const sep: MenuItemConstructorOptions = { type: 'separator' }
  const dev: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [sep, { role: 'reload' }, { role: 'toggleDevTools' }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Lettra',
      submenu: [
        { role: 'about', label: l.about },
        sep,
        { label: l.settings, accelerator: 'CmdOrCtrl+,', click: send('settings') },
        sep,
        { role: 'services', label: l.services },
        sep,
        { role: 'hide', label: l.hide },
        { role: 'hideOthers', label: l.hideOthers },
        { role: 'unhide', label: l.showAll },
        sep,
        { role: 'quit', label: l.quit },
      ],
    },
    {
      // The text fields (search, preview text, collection names, API key) need these.
      label: l.edit,
      submenu: [
        { role: 'undo', label: l.undo },
        { role: 'redo', label: l.redo },
        sep,
        { role: 'cut', label: l.cut },
        { role: 'copy', label: l.copy },
        { role: 'paste', label: l.paste },
        { role: 'selectAll', label: l.selectAll },
      ],
    },
    {
      label: l.view,
      submenu: [
        { label: l.grid, accelerator: 'CmdOrCtrl+1', click: send('view-grid') },
        { label: l.list, accelerator: 'CmdOrCtrl+2', click: send('view-list') },
        sep,
        { label: l.find, accelerator: 'CmdOrCtrl+F', click: send('find') },
        sep,
        { role: 'togglefullscreen', label: l.fullScreen },
        ...dev,
      ],
    },
    {
      role: 'window',
      label: l.window,
      submenu: [
        { role: 'minimize', label: l.minimize },
        { role: 'zoom', label: l.zoom },
        sep,
        { role: 'front', label: l.front },
      ],
    },
    {
      role: 'help',
      label: l.help,
      submenu: [
        { label: l.github, click: () => void shell.openExternal(REPO) },
        { label: l.issue, click: () => void shell.openExternal(`${REPO}/issues/new`) },
        sep,
        { label: l.logs, click: () => void shell.openPath(logDir()) },
        {
          label: l.licenses,
          enabled: existsSync(noticesPath()),
          click: () => void shell.openPath(noticesPath()),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
