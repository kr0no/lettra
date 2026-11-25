import { useTranslation } from 'react-i18next'
import type { LocalFamily } from '@shared/types'

export function SourceBadges({ family }: { family: LocalFamily }) {
  const { t } = useTranslation()
  return (
    <>
      {family.sources.map((source) => (
        <span key={source} className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
          {t(`source.${source}`)}
        </span>
      ))}
      {family.hasDuplicates && (
        <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] text-warning">
          {t('browse.duplicate')}
        </span>
      )}
    </>
  )
}
