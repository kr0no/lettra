import { create } from 'zustand'
import type { AppUpdate, UpdateProgress } from '@shared/types'

interface UpdateState {
  update: AppUpdate | null
  progress: UpdateProgress | null
  dialogOpen: boolean
  checking: boolean
  /** Result of the last manual check, so Settings can say "up to date" or that it failed. */
  checked: 'ok' | 'failed' | null
  setDialogOpen: (open: boolean) => void
}

export const useUpdate = create<UpdateState>()((set) => ({
  update: null,
  progress: null,
  dialogOpen: false,
  checking: false,
  checked: null,
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
}))

export async function checkForUpdate(): Promise<void> {
  useUpdate.setState({ checking: true })
  try {
    const update = await window.fontAPI.appUpdateCheck(true)
    useUpdate.setState({ update, checked: 'ok' })
  } catch {
    useUpdate.setState({ checked: 'failed' })
  } finally {
    useUpdate.setState({ checking: false })
  }
}

// call once at startup
export function listenForUpdates(): void {
  window.fontAPI.on('app:updateAvailable', (update) => useUpdate.setState({ update }))
  window.fontAPI.on('app:updateProgress', (progress) => useUpdate.setState({ progress }))
  void window.fontAPI.appUpdateCheck(false).then((update) => update && useUpdate.setState({ update }))
}
