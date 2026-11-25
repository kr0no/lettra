import { useTranslation } from 'react-i18next'
import type { Catalog } from '@shared/types'
import { useUi, type GoogleSort } from '@/stores/ui'

const SORTS: GoogleSort[] = ['popular', 'newest', 'alpha']

export function SortBar({ origin }: { origin: Catalog['origin'] | undefined }) {
  const { t } = useTranslation()
  const sort = useUi((s) => s.sort)
  const setSort = useUi((s) => s.setSort)
  return (
    <div
      role="group"
      aria-label={t('google.sort')}
      className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-2.5 text-muted"
    >
      <span>{t('google.sort')}</span>
      {SORTS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={sort === s}
          onClick={() => setSort(s)}
          className={`h-[26px] rounded-[13px] border px-2.5 ${
            sort === s
              ? 'border-accent bg-accent-soft text-accent-ink'
              : 'border-line-strong bg-card text-ink hover:bg-hover'
          }`}
        >
          {t(`google.sorts.${s}`)}
        </button>
      ))}
      {origin === 'snapshot' && <span className="ml-auto text-xs">{t('google.offlineCatalog')}</span>}
    </div>
  )
}
