import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, X } from 'lucide-react'
import { errorText } from '@/lib/errors'
import { useFeedback } from '@/stores/feedback'
import { buttonClass, Dialog } from '../dialogs/Dialog'

export function Toaster() {
  const { t } = useTranslation()
  const toasts = useFeedback((s) => s.toasts)
  const dismiss = useFeedback((s) => s.dismiss)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-30 flex w-80 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex animate-[drawer-in_160ms_ease-out] items-start gap-2 rounded-lg border border-line bg-card px-3.5 py-2.5 shadow-xl"
        >
          <div className="min-w-0 flex-1">
            <div className={`text-[13px] font-medium ${toast.tone === 'warning' ? 'text-warning' : ''}`}>
              {toast.message}
            </div>
            {toast.detail && (
              <div className="mt-0.5 line-clamp-3 text-xs break-words text-muted select-text">
                {toast.detail}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={t('feedback.dismiss')}
            onClick={() => dismiss(toast.id)}
            className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-ink"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const { t } = useTranslation()
  const confirm = useFeedback((s) => s.confirm)
  const close = useFeedback((s) => s.closeConfirm)
  const [busy, setBusy] = useState(false)
  if (!confirm) return null
  const run = async (): Promise<void> => {
    setBusy(true)
    try {
      await confirm.onConfirm()
    } catch (error) {
      useFeedback.getState().toast({
        tone: 'warning',
        message: t('feedback.actionFailed'),
        detail: errorText(error),
      })
    } finally {
      setBusy(false)
      if (useFeedback.getState().confirm === confirm) close()
    }
  }
  return (
    <Dialog
      title={confirm.title}
      onClose={close}
      actions={
        <>
          <button type="button" className={buttonClass.secondary} onClick={close}>
            {t('dialogs.cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            className={confirm.danger ? buttonClass.danger : buttonClass.primary}
            onClick={() => void run()}
          >
            {confirm.confirmLabel}
          </button>
        </>
      }
    >
      <p className="m-0">{confirm.body}</p>
    </Dialog>
  )
}

export function DropOverlay() {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-accent/10 p-6 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-surface/95 px-10 py-8 text-center shadow-2xl">
        <Download size={28} className="text-accent" aria-hidden="true" />
        <div className="text-[15px] font-semibold">{t('drop.title')}</div>
        <div className="text-xs text-muted">{t('drop.hint')}</div>
      </div>
    </div>
  )
}
