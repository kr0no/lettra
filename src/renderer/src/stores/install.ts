import { create } from 'zustand'
import { i18n } from '@/i18n'
import { useFeedback } from './feedback'
import type { InstallMode, InstallPlan, InstallProgress, UninstallPlan, UninstallTarget } from '@shared/types'

interface InstallState {
  progress: Record<string, InstallProgress>
  errors: Record<string, string>
  conflict: { plan: InstallPlan; mode: InstallMode } | null
  uninstall: { title: string; target: UninstallTarget; plan: UninstallPlan } | null
  setProgress: (p: InstallProgress) => void
  setError: (key: string, error: string | null) => void
  openConflict: (plan: InstallPlan, mode: InstallMode) => void
  openUninstall: (title: string, target: UninstallTarget, plan: UninstallPlan) => void
  closeDialogs: () => void
}

export const useInstall = create<InstallState>()((set) => ({
  progress: {},
  errors: {},
  conflict: null,
  uninstall: null,
  setProgress: (p) =>
    set((s) => {
      const progress = { ...s.progress }
      if (p.phase === 'done' || p.phase === 'error') delete progress[p.key]
      else progress[p.key] = p
      const errors = { ...s.errors }
      if (p.phase === 'error' && p.error) errors[p.key] = p.error
      else delete errors[p.key]
      return { progress, errors }
    }),
  setError: (key, error) =>
    set((s) => {
      const errors = { ...s.errors }
      if (error) errors[key] = error
      else delete errors[key]
      return { errors }
    }),
  openConflict: (plan, mode) => set({ conflict: { plan, mode } }),
  openUninstall: (title, target, plan) => set({ uninstall: { title, target, plan } }),
  closeDialogs: () => set({ conflict: null, uninstall: null }),
}))

// call once at startup
export function listenForInstallProgress(): void {
  window.fontAPI.on('gf:installProgress', (p) => {
    useInstall.getState().setProgress(p)
    if (p.phase === 'done' && p.error) {
      useFeedback
        .getState()
        .toast({ tone: 'warning', message: i18n.t('google.replaceFailed'), detail: p.error })
    }
  })
}
