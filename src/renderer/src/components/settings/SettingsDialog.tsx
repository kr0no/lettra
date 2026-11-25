import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { InstallMode, Language, Settings, Theme } from '@shared/types'
import { useCatalog, useSettings } from '@/hooks/useGoogle'
import { useUi } from '@/stores/ui'
import { checkForUpdate, useUpdate } from '@/stores/update'
import { buttonClass, Dialog } from '../dialogs/Dialog'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[190px_minmax(0,1fr)] items-start gap-x-4 gap-y-1 py-2">
      <div className="pt-1 text-right text-[13px] font-medium">{label}</div>
      <div className="flex flex-col gap-1">
        {children}
        {hint && <p className="m-0 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  )
}

const save = (patch: Partial<Settings>): void => void window.fontAPI.settingsSet(patch)

const THEMES: { value: Theme; icon: ReactNode }[] = [
  { value: 'system', icon: <Monitor size={13} strokeWidth={1.75} aria-hidden="true" /> },
  { value: 'light', icon: <Sun size={13} strokeWidth={1.75} aria-hidden="true" /> },
  { value: 'dark', icon: <Moon size={13} strokeWidth={1.75} aria-hidden="true" /> },
]

function ApiKeyField({ initial }: { initial: string }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial)
  const typed = useRef(initial)
  // Escape closes the dialog without a blur, so save whatever was typed on the way out too.
  useEffect(
    () => () => {
      if (typed.current !== initial) save({ googleApiKey: typed.current })
    },
    [initial],
  )
  return (
    <label className="flex h-7 items-center rounded-md border border-line-strong bg-card px-2 focus-within:[outline:2px_solid_var(--accent)] focus-within:[outline-offset:1px]">
      <span className="sr-only">{t('settings.apiKey')}</span>
      <input
        type="password"
        value={value}
        autoComplete="off"
        spellCheck={false}
        placeholder={t('settings.apiKeyPlaceholder')}
        onChange={(e) => {
          setValue(e.target.value)
          typed.current = e.target.value
        }}
        onBlur={() => value !== initial && save({ googleApiKey: value })}
        className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted"
      />
    </label>
  )
}

export function SettingsDialog() {
  const { t, i18n } = useTranslation()
  const open = useUi((s) => s.settingsOpen)
  const appUpdate = useUpdate((s) => s.update)
  const checking = useUpdate((s) => s.checking)
  const checked = useUpdate((s) => s.checked)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const { data: settings } = useSettings()
  const { data: catalog, isFetching } = useCatalog()
  const client = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  if (!open || !settings) return null

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      client.setQueryData(['gf-catalog'], await window.fontAPI.gfCatalog({ refresh: true }))
      void client.invalidateQueries({ queryKey: ['gf-updates'] })
    } finally {
      setRefreshing(false)
    }
  }
  const fetched = catalog
    ? new Date(catalog.fetchedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    : '-'

  return (
    <Dialog
      title={t('settings.title')}
      width={640}
      onClose={() => setOpen(false)}
      actions={
        <button type="button" className={buttonClass.primary} onClick={() => setOpen(false)}>
          {t('settings.done')}
        </button>
      }
    >
      <div className="-my-1 flex flex-col divide-y divide-line">
        <Field label={t('settings.language')}>
          <select
            value={settings.language}
            onChange={(e) => save({ language: e.target.value as Language })}
            className="h-7 w-48 rounded-md border border-line-strong bg-card px-2 text-[13px]"
          >
            <option value="system">{t('settings.languages.system')}</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </Field>

        <Field label={t('settings.appearance')}>
          <div
            role="radiogroup"
            aria-label={t('settings.appearance')}
            className="flex w-fit rounded-[7px] bg-field p-0.5"
          >
            {THEMES.map(({ value, icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                onClick={() => save({ theme: value })}
                className={`flex h-[26px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] ${
                  settings.theme === value ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {icon}
                {t(`settings.themes.${value}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('settings.installFormat')} hint={t(`google.modeHint.${settings.installMode}`)}>
          <div role="radiogroup" aria-label={t('settings.installFormat')} className="flex gap-4">
            {(['static', 'variable'] as InstallMode[]).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-[13px]">
                <input
                  type="radio"
                  name="install-mode"
                  checked={settings.installMode === m}
                  onChange={() => save({ installMode: m })}
                />
                {t(`google.modes.${m}`)}
              </label>
            ))}
          </div>
        </Field>

        <Field label={t('settings.offline')} hint={t('settings.offlineHint')}>
          <label className="flex items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={settings.offline}
              onChange={(e) => save({ offline: e.target.checked })}
            />
            {t('settings.offlineLabel')}
          </label>
        </Field>

        <Field label={t('settings.catalog')} hint={t('settings.catalogHint')}>
          <div className="flex flex-col items-start gap-2 pt-1 text-[13px]">
            <span className="text-muted">
              {catalog
                ? t('settings.catalogInfo', {
                    count: catalog.families.length,
                    formatted: catalog.families.length.toLocaleString(i18n.language),
                    date: fetched,
                    source: t(`settings.origin.${catalog.origin}`),
                  })
                : '-'}
            </span>
            <button
              type="button"
              disabled={refreshing || isFetching || settings.offline}
              onClick={() => void refresh()}
              className={`${buttonClass.secondary} shrink-0 disabled:opacity-40`}
            >
              {refreshing ? t('settings.refreshing') : t('settings.refresh')}
            </button>
          </div>
        </Field>

        <Field label={t('settings.updates')}>
          <div className="flex flex-col items-start gap-2 pt-1 text-[13px]">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={settings.checkUpdates}
                onChange={(e) => save({ checkUpdates: e.target.checked })}
              />
              {t('settings.checkUpdates')}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={checking || settings.offline}
                onClick={() => void checkForUpdate()}
                className={`${buttonClass.secondary} shrink-0 disabled:opacity-40`}
              >
                {checking ? t('settings.checking') : t('settings.checkNow')}
              </button>
              {appUpdate ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    useUpdate.getState().setDialogOpen(true)
                  }}
                  className="text-accent-ink hover:underline"
                >
                  {t('update.available', { version: appUpdate.version })}
                </button>
              ) : (
                <span className={checked === 'failed' ? 'text-warning' : 'text-muted'}>
                  {checked === 'failed'
                    ? t('settings.checkFailed')
                    : t(checked === 'ok' ? 'settings.upToDate' : 'settings.current', {
                        version: APP_VERSION,
                      })}
                </span>
              )}
            </div>
          </div>
        </Field>

        <Field label={t('settings.apiKey')} hint={t('settings.apiKeyHint')}>
          <ApiKeyField initial={settings.googleApiKey ?? ''} />
        </Field>
      </div>
    </Dialog>
  )
}
