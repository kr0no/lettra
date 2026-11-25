import { useTranslation } from 'react-i18next'
import { errorText } from '@/lib/errors'
import { useUpdate } from '@/stores/update'
import { buttonClass, Dialog } from '../dialogs/Dialog'

const mb = (bytes: number): string => (bytes / 1_048_576).toFixed(0)

function download(): void {
  useUpdate.setState({ progress: { phase: 'downloading', received: 0, total: 0 } })
  void window.fontAPI.appUpdateDownload()
}

export function UpdateDialog() {
  const { t } = useTranslation()
  const { update, progress, dialogOpen, setDialogOpen } = useUpdate()
  if (!dialogOpen || !update) return null

  const close = (): void => setDialogOpen(false)
  const openRelease = (): void => void window.open(update.url)
  const working = progress?.phase === 'downloading' || progress?.phase === 'verifying'

  let body: string
  let action = (
    <button type="button" data-autofocus className={buttonClass.primary} onClick={download}>
      {t('update.install')}
    </button>
  )
  if (!update.canInstall) {
    body = t(`update.blocked.${update.blocker ?? 'location'}`)
    action = (
      <button type="button" data-autofocus className={buttonClass.primary} onClick={openRelease}>
        {t('update.openPage')}
      </button>
    )
  } else if (progress?.phase === 'downloading') {
    body = progress.total
      ? t('update.downloading', { received: mb(progress.received), total: mb(progress.total) })
      : t('update.starting')
  } else if (progress?.phase === 'verifying') {
    body = t('update.verifying')
  } else if (progress?.phase === 'ready') {
    body = t('update.ready')
    action = (
      <button
        type="button"
        data-autofocus
        className={buttonClass.primary}
        onClick={() => void window.fontAPI.appUpdateInstall()}
      >
        {t('update.restart')}
      </button>
    )
  } else if (progress?.phase === 'error') {
    body = t('update.failed', { message: errorText(progress.message) })
    action = (
      <button type="button" data-autofocus className={buttonClass.primary} onClick={download}>
        {t('update.retry')}
      </button>
    )
  } else {
    body = t('update.intro', { current: APP_VERSION })
  }

  const pct =
    progress?.phase === 'downloading' && progress.total
      ? Math.round((progress.received / progress.total) * 100)
      : null

  return (
    <Dialog
      title={t('update.title', { version: update.version })}
      onClose={close}
      actions={
        <>
          <button type="button" className={buttonClass.secondary} onClick={close}>
            {working ? t('update.hide') : t('update.later')}
          </button>
          {working ? (
            <button type="button" disabled className={`${buttonClass.primary} opacity-40`}>
              {t('update.install')}
            </button>
          ) : (
            action
          )}
        </>
      }
    >
      <p className="m-0 break-words">{body}</p>
      {working && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-chip"
          role="progressbar"
          aria-valuenow={pct ?? undefined}
        >
          <div
            className={`h-full rounded-full bg-accent ${pct === null ? 'w-1/3 animate-pulse' : ''}`}
            style={pct === null ? undefined : { width: `${Math.max(4, pct)}%` }}
          />
        </div>
      )}
      <button type="button" onClick={openRelease} className="w-fit text-xs text-accent-ink hover:underline">
        {t('update.notes')}
      </button>
    </Dialog>
  )
}
