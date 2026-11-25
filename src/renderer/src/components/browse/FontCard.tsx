import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalFamily } from '@shared/types'
import { representative, visibleFaces } from '@/lib/families'
import { FamilyActions } from './FamilyActions'
import { FontPreview } from './FontPreview'
import { SourceBadges } from './SourceBadges'
import { cardHeight, cardPreviewHeight, previewLineHeight } from './layout'

interface FontCardProps {
  family: LocalFamily
  text: string
  size: number
  selected: boolean
  onOpen: (key: string, event?: { metaKey: boolean }) => void
}

// div, not button: it contains buttons. The name is the focusable control.
export const FontCard = memo(function FontCard({ family, text, size, selected, onOpen }: FontCardProps) {
  const { t } = useTranslation()
  const styles = visibleFaces(family).length
  return (
    <div
      onClick={(e) => onOpen(family.key, e)}
      style={{ height: cardHeight(size) }}
      className={`group flex w-full flex-col gap-3.5 overflow-hidden rounded-[10px] border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] ${
        selected ? 'border-accent ring-3 ring-accent-soft' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="flex h-9 w-full min-w-0 items-center gap-1">
        <button
          type="button"
          id={`family-${family.key}`}
          aria-current={selected || undefined}
          onClick={(e) => {
            e.stopPropagation()
            onOpen(family.key, e)
          }}
          className="flex min-w-0 flex-1 flex-col justify-center text-left"
        >
          <span className="w-full truncate text-[13px] font-semibold">{family.name}</span>
          <span className="w-full truncate text-xs text-muted">{t('browse.styles', { count: styles })}</span>
        </button>
        <FamilyActions familyKey={family.key} name={family.name} />
      </div>
      <FontPreview
        face={representative(family)}
        text={text || family.name}
        size={size}
        className="line-clamp-2 w-full overflow-hidden break-words"
        style={{ height: cardPreviewHeight(size), lineHeight: `${previewLineHeight(size)}px` }}
      />
      <div className="flex h-[22px] w-full items-center gap-1.5">
        <SourceBadges family={family} />
      </div>
    </div>
  )
})
