import { useCallback } from 'react'
import type { ConflictChoice, GoogleFamily, InstallMode } from '@shared/types'
import { i18n } from '@/i18n'
import { errorText } from '@/lib/errors'
import { useFeedback } from '@/stores/feedback'
import { useInstall } from '@/stores/install'

function reportFailure(family: string, error: string): void {
  useFeedback
    .getState()
    .toast({ tone: 'warning', message: i18n.t('google.installFailedNamed', { name: family }), detail: error })
}

export async function runInstall(
  family: string,
  key: string,
  mode: InstallMode,
  choice: ConflictChoice,
): Promise<void> {
  const { setError, setProgress } = useInstall.getState()
  setError(key, null)
  // Show progress immediately; main confirms within a few ms.
  setProgress({ key, phase: 'resolving', done: 0, total: 0 })
  try {
    await window.fontAPI.gfInstall(family, mode, choice)
  } catch (e) {
    const message = errorText(e) || i18n.t('google.installFailed')
    setProgress({ key, phase: 'error', done: 0, total: 0, error: message })
    reportFailure(family, message)
  }
}

// Plans first; if a local family has the same name, the conflict dialog takes over.
export function useInstallAction(): (family: GoogleFamily, mode: InstallMode) => Promise<void> {
  return useCallback(async (family, mode) => {
    const { setError, openConflict } = useInstall.getState()
    try {
      const plan = await window.fontAPI.gfInstallPlan(family.family, mode)
      if (plan.conflict) openConflict(plan, plan.mode)
      else await runInstall(family.family, family.key, plan.mode, 'install-anyway')
    } catch (e) {
      setError(family.key, errorText(e) || i18n.t('google.installFailed'))
      reportFailure(family.family, errorText(e) || i18n.t('google.installFailed'))
    }
  }, [])
}

export async function runGoogleUninstall(family: GoogleFamily): Promise<void> {
  const { setError } = useInstall.getState()
  try {
    await window.fontAPI.gfUninstall(family.family)
  } catch (e) {
    setError(family.key, errorText(e))
  }
}
