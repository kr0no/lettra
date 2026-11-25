import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Download, RefreshCw } from 'lucide-react'
import type { GoogleFamily } from '@shared/types'
import { useInstalled, useInstallStatus, useSettings, useUpdates } from '@/hooks/useGoogle'
import { useInstallAction } from '@/hooks/useInstallAction'
import { useInstall } from '@/stores/install'

const stop = (e: MouseEvent): void => e.stopPropagation()

// Install / progress / installed / update. Tinted on cards and rows, filled when `prominent`
// (drawer). Clicks don't bubble up to the card.
export function InstallButton({
  family,
  compact = false,
  prominent = false,
}: {
  family: GoogleFamily
  compact?: boolean
  prominent?: boolean
}) {
  const { t } = useTranslation()
  const status = useInstallStatus()(family.key)
  const progress = useInstall((s) => s.progress[family.key])
  const error = useInstall((s) => s.errors[family.key])
  const { data: updates } = useUpdates()
  const { data: settings } = useSettings()
  const install = useInstallAction()
  const mode = settings?.installMode ?? 'static'
  // An update keeps the format the family was installed in.
  const { data: installed } = useInstalled()
  const updateMode = installed?.find((r) => r.key === family.key)?.mode ?? mode
  const hasUpdate = updates?.some((u) => u.key === family.key) ?? false

  if (progress) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : null
    return (
      <span className="flex items-center gap-2 text-xs text-muted" role="status">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-chip">
          <span
            className={`block h-full rounded-full bg-accent ${pct === null ? 'w-1/3 animate-pulse' : ''}`}
            style={pct === null ? undefined : { width: `${Math.max(8, pct)}%` }}
          />
        </span>
        {t(`google.phase.${progress.phase}`)}
      </span>
    )
  }

  if (hasUpdate) {
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e)
          void install(family, updateMode)
        }}
        className="flex h-[26px] items-center gap-1.5 rounded-md border border-accent px-2.5 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
      >
        <RefreshCw size={12} aria-hidden="true" />
        {t('google.update')}
      </button>
    )
  }

  if (status !== 'none') {
    return (
      <span
        className="flex items-center gap-1 text-xs text-success"
        title={status === 'local' ? t('google.installedElsewhere') : undefined}
      >
        <Check size={13} strokeWidth={2.25} aria-hidden="true" />
        {t('google.installed')}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      {error && !compact && (
        <span className="max-w-[140px] truncate text-xs text-warning" title={error}>
          {t('google.failed')}
        </span>
      )}
      <button
        type="button"
        title={error}
        onClick={(e) => {
          stop(e)
          void install(family, mode)
        }}
        className={`flex h-[26px] items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${
          prominent
            ? 'bg-accent text-white hover:brightness-110'
            : 'bg-chip text-accent-ink hover:bg-accent-soft'
        }`}
      >
        {!compact && <Download size={12} aria-hidden="true" />}
        {error ? t('google.retry') : t('google.install')}
      </button>
    </span>
  )
}
