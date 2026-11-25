import type {
  AppCommand,
  AppUpdate,
  Catalog,
  ConflictChoice,
  GoogleFamilyInfo,
  GoogleUpdate,
  InstallMode,
  InstallPlan,
  InstallProgress,
  InstallFilesResult,
  InstallRecord,
  Library,
  LocalFamily,
  PreviewFace,
  ScanStatus,
  Settings,
  UninstallPlan,
  UninstallTarget,
  UpdateProgress,
} from './types'

// invoke/handle channels: args tuple and result. The preload exposes each one on window.fontAPI.
export interface InvokeContract {
  'fonts:list': { args: []; result: LocalFamily[] }
  'fonts:rescan': { args: []; result: LocalFamily[] }
  'fonts:status': { args: []; result: ScanStatus }
  'fonts:coverage': { args: [faceId: string]; result: number[] }
  'fonts:reveal': { args: [faceId: string]; result: void }
  'fonts:uninstallPlan': { args: [target: UninstallTarget]; result: UninstallPlan }
  'fonts:uninstall': { args: [target: UninstallTarget]; result: void }
  'fonts:installFiles': { args: [paths: string[]]; result: InstallFilesResult }
  'library:get': { args: []; result: Library }
  'library:toggleFavorite': { args: [key: string]; result: Library }
  'library:collectionCreate': { args: [name: string, keys: string[]]; result: Library }
  'library:collectionRename': { args: [id: string, name: string]; result: Library }
  'library:collectionDelete': { args: [id: string]; result: Library }
  'library:collectionAdd': { args: [id: string, keys: string[]]; result: Library }
  'library:collectionRemove': { args: [id: string, keys: string[]]; result: Library }
  'gf:catalog': { args: [options?: { refresh?: boolean }]; result: Catalog }
  'gf:previewFaces': { args: [family: string, variant: string]; result: PreviewFace[] }
  'gf:info': { args: [family: string]; result: GoogleFamilyInfo }
  'gf:installed': { args: []; result: InstallRecord[] }
  'gf:installPlan': { args: [family: string, mode: InstallMode]; result: InstallPlan }
  'gf:install': {
    args: [family: string, mode: InstallMode, choice: ConflictChoice]
    result: InstallRecord | null
  }
  'gf:uninstall': { args: [family: string]; result: void }
  'gf:updates': { args: []; result: GoogleUpdate[] }
  'settings:get': { args: []; result: Settings }
  'settings:set': { args: [patch: Partial<Settings>]; result: Settings }
  'app:logError': { args: [message: string, stack: string]; result: void }
  /** `force` asks GitHub now; otherwise returns what the last check found. */
  'app:updateCheck': { args: [force: boolean]; result: AppUpdate | null }
  'app:updateDownload': { args: []; result: void }
  'app:updateInstall': { args: []; result: void }
}

/** Events pushed from main to renderer (webContents.send <-> ipcRenderer.on). */
export interface EventContract {
  'fonts:changed': void
  'fonts:status': ScanStatus
  'settings:changed': Settings
  'gf:installProgress': InstallProgress
  'gf:installedChanged': InstallRecord[]
  'library:changed': Library
  'app:command': AppCommand
  'app:updateAvailable': AppUpdate
  'app:updateProgress': UpdateProgress
}

export type InvokeChannel = keyof InvokeContract
export type EventChannel = keyof EventContract

export const INVOKE_CHANNELS = [
  'fonts:list',
  'fonts:rescan',
  'fonts:status',
  'fonts:coverage',
  'fonts:reveal',
  'fonts:uninstallPlan',
  'fonts:uninstall',
  'fonts:installFiles',
  'library:get',
  'library:toggleFavorite',
  'library:collectionCreate',
  'library:collectionRename',
  'library:collectionDelete',
  'library:collectionAdd',
  'library:collectionRemove',
  'gf:catalog',
  'gf:previewFaces',
  'gf:info',
  'gf:installed',
  'gf:installPlan',
  'gf:install',
  'gf:uninstall',
  'gf:updates',
  'settings:get',
  'settings:set',
  'app:logError',
  'app:updateCheck',
  'app:updateDownload',
  'app:updateInstall',
] as const satisfies readonly InvokeChannel[]

// Compile-time check that INVOKE_CHANNELS lists every channel: fails to compile if one is missing.
type Missing = Exclude<InvokeChannel, (typeof INVOKE_CHANNELS)[number]>
export type AssertAllChannelsListed = [Missing] extends [never] ? true : { missing: Missing }
true satisfies AssertAllChannelsListed

export const EVENT_CHANNELS = [
  'fonts:changed',
  'fonts:status',
  'settings:changed',
  'gf:installProgress',
  'gf:installedChanged',
  'library:changed',
  'app:command',
  'app:updateAvailable',
  'app:updateProgress',
] as const satisfies readonly EventChannel[]

/** Method name on window.fontAPI for a channel: 'fonts:list' -> 'fontsList'. */
type MethodName<C extends string> = C extends `${infer A}:${infer B}` ? `${A}${Capitalize<B>}` : never

export type FontAPI = {
  [C in InvokeChannel as MethodName<C>]: (
    ...args: InvokeContract[C]['args']
  ) => Promise<InvokeContract[C]['result']>
} & {
  on<E extends EventChannel>(channel: E, listener: (payload: EventContract[E]) => void): () => void
  /** Absolute path of a file dropped onto the window (Electron's webUtils). */
  pathForFile(file: File): string
}

export function methodName(channel: string): string {
  const [a = '', b = ''] = channel.split(':')
  return a + b.charAt(0).toUpperCase() + b.slice(1)
}

export const FONT_PROTOCOL = 'lettra-font'
export const faceUrl = (faceId: string): string => `${FONT_PROTOCOL}://face/${faceId}`
