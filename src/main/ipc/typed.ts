import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { EventChannel, EventContract, InvokeChannel, InvokeContract } from '@shared/ipc-contract'
import { log } from '../log'

type Handler<C extends InvokeChannel> = (
  ...args: InvokeContract[C]['args']
) => InvokeContract[C]['result'] | Promise<InvokeContract[C]['result']>

/** Only accept IPC from Lettra's own pages (dev server or bundled file), never from other frames. */
function trusted(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  const dev = process.env.ELECTRON_RENDERER_URL
  return url.startsWith('file://') || (dev !== undefined && url.startsWith(dev))
}

export function handle<C extends InvokeChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    if (!trusted(event)) throw new Error(`Blocked IPC ${channel} from untrusted frame`)
    try {
      return await handler(...(args as InvokeContract[C]['args']))
    } catch (error) {
      log.warn(`${channel} failed`, error)
      throw error
    }
  })
}

export function broadcast<E extends EventChannel>(channel: E, payload: EventContract[E]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`)
}
