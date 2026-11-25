import { create } from 'zustand'
import { DEFAULT_SETTINGS, PREVIEW_SIZE } from '@shared/defaults'
import type { Settings, ViewMode } from '@shared/types'

interface PreviewState {
  text: string
  size: number
  view: ViewMode
  setText: (text: string) => void
  setSize: (size: number) => void
  setView: (view: ViewMode) => void
}

export const usePreview = create<PreviewState>()((set) => ({
  ...DEFAULT_SETTINGS.preview,
  setText: (text) => set({ text }),
  setSize: (size) => set({ size: Math.min(PREVIEW_SIZE.max, Math.max(PREVIEW_SIZE.min, size)) }),
  setView: (view) => set({ view }),
}))

let saveTimer: ReturnType<typeof setTimeout> | undefined

/** Seeds the store from saved settings, then saves changes (debounced) back to main. */
export function hydratePreview(settings: Settings): void {
  usePreview.setState(settings.preview)
  usePreview.subscribe(({ text, size, view }) => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void window.fontAPI.settingsSet({ preview: { text, size, view } }), 400)
  })
}
