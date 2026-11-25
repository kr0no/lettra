import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, List, Search } from 'lucide-react'
import { MAX_PREVIEW_TEXT, PREVIEW_SIZE } from '@shared/defaults'
import type { ScanStatus, ViewMode } from '@shared/types'
import { usePreview } from '@/stores/preview'
import { useUi } from '@/stores/ui'

interface ToolbarProps {
  title: string
  total: number
  status: ScanStatus | null
  searchRef: Ref<HTMLInputElement>
  comparing?: boolean
}

const fieldClass =
  'no-drag flex h-[30px] items-center gap-1.5 rounded-[7px] bg-field px-2.5 text-muted focus-within:[outline:2px_solid_var(--accent)] focus-within:[outline-offset:1px]'

export function Toolbar({ title, total, status, searchRef, comparing = false }: ToolbarProps) {
  const { t, i18n } = useTranslation()
  const query = useUi((s) => s.query)
  const setQuery = useUi((s) => s.setQuery)
  const { text, size, view, setText, setSize, setView } = usePreview()

  const viewButton = (mode: ViewMode, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={view === mode}
      onClick={() => setView(mode)}
      className={`grid h-[26px] w-[30px] place-items-center rounded-[5px] ${
        view === mode ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {icon}
    </button>
  )

  return (
    <header className="drag @container flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line bg-toolbar px-5 py-3">
      <div className="mr-2 flex min-w-0 shrink items-baseline gap-2 @max-[760px]:hidden">
        <h1 className="m-0 truncate text-[15px] font-semibold">{title}</h1>
        {status?.state === 'scanning' && status.toParse > 0 && (
          <span className="text-xs text-muted">
            {t('toolbar.scanning', { parsed: status.parsed, total: status.toParse })}
          </span>
        )}
      </div>

      <label hidden={comparing} className={`${fieldClass} max-w-[240px] flex-[1_0_196px]`}>
        <Search size={13} aria-hidden="true" />
        <span className="sr-only">{t('toolbar.searchLabel')}</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Escape' && (e.currentTarget.value ? setQuery('') : e.currentTarget.blur())
          }
          placeholder={t('toolbar.search', { count: total, formatted: total.toLocaleString(i18n.language) })}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
        />
      </label>

      <label className="no-drag flex h-[30px] min-w-[120px] flex-[2_1_220px] items-center rounded-[7px] border border-line-strong bg-card px-2.5 focus-within:[outline:2px_solid_var(--accent)] focus-within:[outline-offset:1px]">
        <span className="sr-only">{t('toolbar.previewText')}</span>
        <input
          type="text"
          value={text}
          maxLength={MAX_PREVIEW_TEXT}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('toolbar.previewPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
        />
      </label>

      <label className="no-drag flex shrink-0 items-center gap-2 text-muted">
        <span className="@max-[760px]:sr-only">{t('toolbar.size')}</span>
        <input
          type="range"
          min={PREVIEW_SIZE.min}
          max={PREVIEW_SIZE.max}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-[110px] @max-[760px]:w-[80px]"
        />
        <span className="w-[38px] tabular-nums text-ink">{size} px</span>
      </label>

      <div
        role="group"
        aria-label={t('toolbar.view')}
        hidden={comparing}
        className="no-drag flex shrink-0 rounded-[7px] bg-field p-0.5"
      >
        {viewButton('grid', t('toolbar.grid'), <LayoutGrid size={14} strokeWidth={1.75} />)}
        {viewButton('list', t('toolbar.list'), <List size={14} strokeWidth={1.75} />)}
      </div>
    </header>
  )
}
