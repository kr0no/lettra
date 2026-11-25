import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  EVENT_CHANNELS,
  INVOKE_CHANNELS,
  methodName,
  type EventChannel,
  type FontAPI,
} from '@shared/ipc-contract'

const api: Record<string, unknown> = {}
for (const channel of INVOKE_CHANNELS) {
  api[methodName(channel)] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
}

const allowedEvents = new Set<string>(EVENT_CHANNELS)
api.on = (channel: EventChannel, listener: (payload: unknown) => void) => {
  if (!allowedEvents.has(channel)) throw new Error(`Unknown event channel ${channel}`)
  const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

api.pathForFile = (file: File) => webUtils.getPathForFile(file)

contextBridge.exposeInMainWorld('fontAPI', api as FontAPI)
