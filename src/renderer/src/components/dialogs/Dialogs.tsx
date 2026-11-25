import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { familyKey } from '@shared/family-key'
import { runInstall } from '@/hooks/useInstallAction'
import { errorText } from '@/lib/errors'
import { useFeedback } from '@/stores/feedback'
import { useInstall } from '@/stores/install'
import { buttonClass, Dialog } from './Dialog'

function ConflictDialog() {
  const { t } = useTranslation()
  const conflict = useInstall((s) => s.conflict)
  const close = useInstall((s) => s.closeDialogs)
  if (!conflict) return null
  const { plan, mode } = conflict
  const c = plan.conflict!
  const choose = (choice: 'install-anyway' | 'replace'): void => {
    close()
    void runInstall(plan.family, familyKey(plan.family), mode, choice)
  }
  return (
    <Dialog
      title={t('dialogs.conflict.title', { family: plan.family })}
      onClose={close}
      actions={
        <>
          <button type="button" className={buttonClass.secondary} onClick={close}>
            {t('dialogs.cancel')}
          </button>
          {c.removableFaces > 0 && (
            <button
              type="button"
              className={`${buttonClass.secondary} text-danger`}
              onClick={() => choose('replace')}
            >
              {t('dialogs.conflict.replace')}
            </button>
          )}
          <button type="button" className={buttonClass.primary} onClick={() => choose('install-anyway')}>
            {t('dialogs.conflict.installAnyway')}
          </button>
        </>
      }
    >
      <p className="m-0">
        {t('dialogs.conflict.body', {
          name: c.name,
          sources: c.sources.map((s) => t(`source.${s}`)).join(', '),
        })}
      </p>
      <p className="m-0 text-muted">
        {c.removableFaces > 0
          ? t('dialogs.conflict.replaceHint', { count: c.removableFaces })
          : t('dialogs.conflict.readOnlyHint')}
      </p>
    </Dialog>
  )
}

function UninstallDialog() {
  const { t } = useTranslation()
  const pending = useInstall((s) => s.uninstall)
  const close = useInstall((s) => s.closeDialogs)
  const [busy, setBusy] = useState(false)
  // Kept with the dialog it belongs to, so the next one doesn't show it.
  const [failure, setFailure] = useState<{ for: unknown; message: string } | null>(null)
  const error = failure && failure.for === pending ? failure.message : null
  if (!pending) return null
  const { plan } = pending
  const confirm = async (): Promise<void> => {
    setBusy(true)
    setFailure(null)
    try {
      await window.fontAPI.fontsUninstall(pending.target)
      // Only close the dialog this was for, not one opened while it ran.
      if (useInstall.getState().uninstall === pending) close()
    } catch (e) {
      // Closed with Escape while it ran: the dialog is gone, so tell the user another way.
      if (useInstall.getState().uninstall === pending) setFailure({ for: pending, message: errorText(e) })
      else
        useFeedback
          .getState()
          .toast({ tone: 'warning', message: t('feedback.actionFailed'), detail: errorText(e) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={t('dialogs.uninstall.title', { name: pending.title })}
      onClose={close}
      actions={
        <>
          <button type="button" className={buttonClass.secondary} onClick={close}>
            {t('dialogs.cancel')}
          </button>
          <button
            type="button"
            className={buttonClass.danger}
            disabled={busy || !plan.files.length}
            onClick={() => void confirm()}
          >
            {t('dialogs.uninstall.confirm')}
          </button>
        </>
      }
    >
      <p className="m-0">{t('dialogs.uninstall.body', { count: plan.files.length })}</p>
      <ul className="m-0 max-h-[140px] list-none overflow-y-auto rounded-md border border-line p-2 font-mono text-[11px] text-muted select-text">
        {plan.files.map((f) => (
          <li key={f} className="truncate" title={f}>
            {f.split('/').slice(-2).join('/')}
          </li>
        ))}
      </ul>
      {plan.collectionWarning && (
        <p className="m-0 rounded-md bg-warning-soft px-2.5 py-1.5 text-warning">
          {t('dialogs.uninstall.collectionWarning', { faces: plan.faces.map((f) => f.name).join(', ') })}
        </p>
      )}
      {plan.readOnlyFaces > 0 && (
        <p className="m-0 text-muted">{t('dialogs.uninstall.readOnly', { count: plan.readOnlyFaces })}</p>
      )}
      {error && <p className="m-0 text-warning">{error}</p>}
    </Dialog>
  )
}

export function Dialogs() {
  return (
    <>
      <ConflictDialog />
      <UninstallDialog />
    </>
  )
}

export async function confirmUninstall(
  title: string,
  target: Parameters<typeof window.fontAPI.fontsUninstallPlan>[0],
): Promise<void> {
  const plan = await window.fontAPI.fontsUninstallPlan(target)
  useInstall.getState().openUninstall(title, target, plan)
}
