import { useState, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Download, Trash2, X } from 'lucide-react'
import type { GoogleFamily, InstallMode } from '@shared/types'
import { DEFAULT_PREVIEW_TEXT } from '@shared/defaults'
import { useGoogleInfo, useInstalled, useInstallStatus, useSettings } from '@/hooks/useGoogle'
import { runGoogleUninstall, useInstallAction } from '@/hooks/useInstallAction'
import { defaultVariant } from '@/lib/google-loader'
import { googleSample } from '@/lib/sample-text'
import { useFeedback } from '@/stores/feedback'
import { useInstall } from '@/stores/install'
import { usePreview } from '@/stores/preview'
import { FamilyActions } from '../browse/FamilyActions'
import { Section } from '../detail/Section'
import { CollectionMenu } from '../library/CollectionMenu'
import { GooglePreview } from './GooglePreview'
import { InstallButton } from './InstallButton'

const WATERFALL = [12, 16, 20, 24, 32, 40, 48, 64]

function variantLabel(variant: string, t: TFunction): string {
  const weight = Number.parseInt(variant, 10) || 400
  const name = t(`weights.${weight}`)
  if (!variant.endsWith('i')) return name
  return weight === 400 ? t('weights.italic') : `${name} ${t('weights.italic')}`
}

const setMode = (m: InstallMode): void => void window.fontAPI.settingsSet({ installMode: m })

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words select-text">{children}</dd>
    </>
  )
}

export function GoogleDrawer({ family, onClose }: { family: GoogleFamily; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const previewText = usePreview((s) => s.text)
  const status = useInstallStatus()(family.key)
  const { data: installed } = useInstalled()
  const record = installed?.find((r) => r.key === family.key)
  const { data: info } = useGoogleInfo(family.family)
  const { data: settings } = useSettings()
  const busy = useInstall((s) => Boolean(s.progress[family.key]))
  const [removing, setRemoving] = useState(false)
  const error = useInstall((s) => s.errors[family.key])
  const mode = settings?.installMode ?? 'static'
  const install = useInstallAction()
  const variant = defaultVariant(family)
  const sample = googleSample(family, previewText || DEFAULT_PREVIEW_TEXT)
  const date = (iso: string): string =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : '-'

  return (
    <aside
      aria-label={family.family}
      className="flex w-[420px] shrink-0 max-[1240px]:w-[360px] animate-[drawer-in_160ms_ease-out] flex-col border-l border-line bg-surface"
    >
      <div className="drag flex shrink-0 flex-col gap-3 border-b border-line px-5 pt-4 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <GooglePreview
              family={family}
              variant={variant}
              text={family.family}
              size={28}
              className="truncate leading-[1.2]"
            />
            <div className="mt-1 truncate text-xs text-muted">{family.designers.join(', ')}</div>
          </div>
          <span className="no-drag flex shrink-0 items-center">
            <FamilyActions familyKey={family.key} name={family.family} persistent />
            <CollectionMenu familyKey={family.key} />
          </span>
          <button
            type="button"
            aria-label={t('detail.close')}
            title={t('detail.close')}
            onClick={onClose}
            className="no-drag grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
            {t(`category.${family.category}`)}
          </span>
          {family.axes.length > 0 && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-ink">
              {t('detail.variable')}
            </span>
          )}
          {info?.license && (
            <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
              {t(`google.licenses.${info.license}`)}
            </span>
          )}
        </div>
        <div className="no-drag flex flex-wrap items-center gap-2">
          <InstallButton family={family} prominent />
          {status === 'lettra' && !busy && (
            <button
              type="button"
              disabled={removing}
              onClick={() =>
                useFeedback.getState().ask({
                  title: t('dialogs.uninstall.title', { name: family.family }),
                  body: t('google.uninstallBody', {
                    count: record?.files.length ?? 0,
                    folder: record?.dir.split('/').pop() ?? family.family,
                  }),
                  confirmLabel: t('dialogs.uninstall.confirm'),
                  danger: true,
                  onConfirm: async () => {
                    setRemoving(true)
                    await runGoogleUninstall(family).finally(() => setRemoving(false))
                  },
                })
              }
              className="flex h-[26px] items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-xs hover:bg-hover disabled:opacity-40"
            >
              <Trash2 size={12} aria-hidden="true" />
              {t('google.uninstall')}
            </button>
          )}
          {status === 'local' && !busy && (
            <button
              type="button"
              onClick={() => void install(family, mode)}
              className="flex h-[26px] items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-xs hover:bg-hover"
            >
              <Download size={12} aria-hidden="true" />
              {t('google.installGoogleVersion')}
            </button>
          )}
          {family.axes.length > 0 && status !== 'lettra' && !busy && (
            <div
              role="group"
              aria-label={t('google.mode')}
              className="ml-auto flex rounded-[7px] bg-field p-0.5 text-xs"
            >
              {(['static', 'variable'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  title={t(`google.modeHint.${m}`)}
                  onClick={() => setMode(m)}
                  className={`h-[22px] rounded-[5px] px-2 ${mode === m ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                >
                  {t(`google.modes.${m}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        {status === 'local' && <p className="m-0 text-xs text-muted">{t('google.installedElsewhere')}</p>}
        {error && <p className="m-0 text-xs break-words text-warning select-text">{error}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title={t('detail.waterfall')}>
          {WATERFALL.map((size) => (
            <div key={size} className="flex min-w-0 items-baseline gap-3">
              <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums">
                {size}
              </span>
              <GooglePreview
                family={family}
                variant={variant}
                text={sample}
                size={size}
                className="min-w-0 flex-1 truncate leading-[1.2]"
              />
            </div>
          ))}
        </Section>

        <Section title={`${t('detail.styles')} · ${family.variants.length}`}>
          {family.variants.map((v) => (
            <div key={v} className="flex min-h-9 items-center gap-3">
              <span className="w-[104px] shrink-0 truncate text-xs text-muted">{variantLabel(v, t)}</span>
              <GooglePreview
                family={family}
                variant={v}
                text={googleSample(family, previewText || family.family)}
                size={22}
                className="min-w-0 flex-1 truncate leading-[1.25]"
              />
            </div>
          ))}
        </Section>

        <Section title={t('google.about')}>
          <dl className="m-0 grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            <Row label={t('google.designers')}>{family.designers.join(', ') || '-'}</Row>
            <Row label={t('google.license')}>
              {info?.license ? t(`google.licenses.${info.license}`) : '-'}
            </Row>
            {family.axes.length > 0 && (
              <Row label={t('detail.axes')}>
                {family.axes
                  .map((a) => t('google.axisRange', { name: a.name, min: a.min, max: a.max }))
                  .join(' · ')}
              </Row>
            )}
            <Row label={t('google.subsets')}>{family.subsets.join(', ') || '-'}</Row>
            <Row label={t('google.added')}>{date(family.dateAdded)}</Row>
            <Row label={t('google.updated')}>{date(family.lastModified)}</Row>
            <Row label={t('google.popularity')}>#{family.popularity.toLocaleString(i18n.language)}</Row>
            {record && (
              <>
                <Row label={t('google.installedAs')}>{t(`google.modes.${record.mode}`)}</Row>
                <Row label={t('detail.location')}>
                  <span className="font-mono text-[11px] break-all">{record.dir}</span>
                </Row>
              </>
            )}
          </dl>
        </Section>
      </div>
    </aside>
  )
}
