import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Columns2, Download, X } from 'lucide-react'
import { useInstallStatus, useSettings } from '@/hooks/useGoogle'
import { useInstallAction } from '@/hooks/useInstallAction'
import { useInstall } from '@/stores/install'
import { DEFAULT_PREVIEW_TEXT } from '@shared/defaults'
import { useResolvedFamilies, type MixedFamily } from '@/hooks/useLibrary'
import { representative } from '@/lib/families'
import { defaultVariant } from '@/lib/google-loader'
import { googleSample } from '@/lib/sample-text'
import { usePreview } from '@/stores/preview'
import { MAX_COMPARE, useUi } from '@/stores/ui'
import { FontPreview } from '../browse/FontPreview'
import { SourceBadges } from '../browse/SourceBadges'
import { GooglePreview } from '../google/GooglePreview'
import { InstallButton } from '../google/InstallButton'

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &?!@%'

function Specimen({
  family,
  text,
  size,
  className,
}: {
  family: MixedFamily
  text: string
  size: number
  className: string
}) {
  if (family.local)
    return <FontPreview face={representative(family.local)} text={text} size={size} className={className} />
  return (
    <GooglePreview
      family={family.google!}
      variant={defaultVariant(family.google!)}
      text={googleSample(family.google!, text)}
      size={size}
      className={className}
    />
  )
}

export function CompareView() {
  const { t } = useTranslation()
  const keys = useUi((s) => s.compare)
  const togglePin = useUi((s) => s.togglePin)
  const setComparing = useUi((s) => s.setComparing)
  const families = useResolvedFamilies(keys)
  const { text, size } = usePreview()
  const sample = text || DEFAULT_PREVIEW_TEXT
  const status = useInstallStatus()
  const progress = useInstall((s) => s.progress)
  const { data: settings } = useSettings()
  const install = useInstallAction()
  const [installingAll, setInstallingAll] = useState(false)
  const installable = families.flatMap((f) =>
    !f.local && f.google && status(f.key) === 'none' && !progress[f.key] ? [f.google] : [],
  )
  // One by one, and stop at the first name conflict so its dialog isn't overwritten.
  const installAll = async (): Promise<void> => {
    setInstallingAll(true)
    try {
      for (const family of installable) {
        await install(family, settings?.installMode ?? 'static')
        if (useInstall.getState().conflict) break
      }
    } finally {
      setInstallingAll(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-5 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setComparing(false)}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-accent-ink hover:bg-hover"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t('compare.back')}
        </button>
        {installable.length > 1 && (
          <button
            type="button"
            disabled={installingAll}
            onClick={() => void installAll()}
            className="ml-auto flex h-[26px] items-center gap-1.5 rounded-md bg-chip px-3 text-xs font-semibold text-accent-ink hover:bg-accent-soft disabled:opacity-40"
          >
            <Download size={12} aria-hidden="true" />
            {t('compare.installAll', { count: installable.length })}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {families.map((f) => (
          <section
            key={f.key}
            aria-label={f.name}
            className="flex flex-col gap-2 border-b border-line px-6 py-5"
          >
            <div className="flex items-center gap-2">
              <h2 className="m-0 mr-1 min-w-0 truncate text-[13px] font-semibold">{f.name}</h2>
              <span className="flex flex-1 items-center gap-1.5">
                {f.local ? (
                  <SourceBadges family={f.local} />
                ) : (
                  <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
                    {t('sidebar.google')}
                  </span>
                )}
              </span>
              {!f.local && f.google && <InstallButton family={f.google} />}
              <button
                type="button"
                aria-label={t('compare.unpin', { name: f.name })}
                onClick={() => togglePin(f.key)}
                className="grid size-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
            <Specimen family={f} text={sample} size={size} className="min-w-0 break-words leading-[1.2]" />
            <Specimen
              family={f}
              text={CHARACTERS}
              size={16}
              className="min-w-0 break-words leading-[1.5] text-muted"
            />
          </section>
        ))}
      </div>
    </div>
  )
}

export function CompareBar() {
  const { t } = useTranslation()
  const keys = useUi((s) => s.compare)
  const togglePin = useUi((s) => s.togglePin)
  const clear = useUi((s) => s.clearCompare)
  const setComparing = useUi((s) => s.setComparing)
  const families = useResolvedFamilies(keys)
  if (!families.length) return null
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-line bg-toolbar px-4 py-2">
      <Columns2 size={15} className="shrink-0 text-muted" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {families.map((f) => (
          <span key={f.key} className="flex h-6 items-center gap-1 rounded-full bg-chip pr-1 pl-2.5 text-xs">
            <span className="max-w-[160px] truncate">{f.name}</span>
            <button
              type="button"
              aria-label={t('compare.unpin', { name: f.name })}
              onClick={() => togglePin(f.key)}
              className="grid size-4 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <span className="self-center text-xs whitespace-nowrap text-muted">
          {t('compare.count', { count: families.length, max: MAX_COMPARE })}
        </span>
      </div>
      <button
        type="button"
        onClick={clear}
        className="h-7 rounded-md px-2.5 text-[13px] text-muted hover:bg-hover hover:text-ink"
      >
        {t('compare.clear')}
      </button>
      <button
        type="button"
        disabled={families.length < 2}
        onClick={() => setComparing(true)}
        title={families.length < 2 ? t('compare.needTwo') : undefined}
        className="h-7 rounded-md bg-accent px-3 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
      >
        {t('compare.open')}
      </button>
    </div>
  )
}
