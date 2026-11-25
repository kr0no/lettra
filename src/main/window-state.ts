import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { log } from './log'

interface WindowState {
  bounds: Rectangle
  maximized: boolean
}

const statePath = (): string => join(app.getPath('userData'), 'window-state.json')

const isRect = (r: unknown): r is Rectangle =>
  !!r && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite((r as Record<string, unknown>)[k]))

// Saved bounds, unless the display they were on is gone.
export function loadWindowState(): WindowState | null {
  try {
    const state = JSON.parse(readFileSync(statePath(), 'utf8')) as WindowState
    if (!isRect(state.bounds)) return null
    const area = screen.getDisplayMatching(state.bounds).workArea
    const visible =
      state.bounds.x < area.x + area.width &&
      state.bounds.x + state.bounds.width > area.x &&
      state.bounds.y < area.y + area.height &&
      state.bounds.y + state.bounds.height > area.y
    return visible ? state : null
  } catch {
    return null
  }
}

export function trackWindowState(win: BrowserWindow): void {
  const save = (): void => {
    if (win.isDestroyed() || win.isFullScreen()) return
    const state: WindowState = { bounds: win.getNormalBounds(), maximized: win.isMaximized() }
    try {
      writeFileSync(statePath(), JSON.stringify(state))
    } catch (error) {
      log.warn("couldn't save the window position", error)
    }
  }
  let timer: NodeJS.Timeout | undefined
  const later = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  win.on('resize', later)
  win.on('move', later)
  win.on('close', () => {
    clearTimeout(timer)
    save()
  })
}
