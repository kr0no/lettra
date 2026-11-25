import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalFamily } from '@shared/types'
import { representative, visibleFaces } from '@/lib/families'
import { FamilyActions } from './FamilyActions'
import { FontPreview } from './FontPreview'
import { SourceBadges } from './SourceBadges'

interface FontRowProps {
  family: LocalFamily
  text: string
  size: number
  selected: boolean
  onOpen: (key: string, event?: { metaKey: boolean }) => void
}

export const FontRow = memo(function FontRow({ family, text, size, selected, onOpen }: FontRowProps) {
  const { t } = useTranslation()
  return (
    <div
      onClick={(e) => onOpen(family.key, e)}
      className={`group @container flex h-full w-full items-center gap-5 border-b border-line px-5 ${selected ? 'bg-accent-soft' : 'hover:bg-hover'}`}
    >
      <button
        type="button"
        id={`family-${family.key}`}
        aria-current={selected || undefined}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(family.key, e)
        }}
        className="flex w-[220px] shrink-0 flex-col gap-0.5 text-left"
      >
        <span className="w-full truncate text-[13px] font-semibold">{family.name}</span>
        <span className="w-full truncate text-xs text-muted">
          {t('browse.styles', { count: visibleFaces(family).length })}
        </span>
      </button>
      <FontPreview
        face={representative(family)}
        text={text || family.name}
        size={size}
        className="min-w-0 flex-1 truncate leading-[1.25]"
      />
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Narrow rows (drawer open) give the room to the preview instead. */}
        <span className="flex items-center gap-1.5 @max-[640px]:hidden">
          <SourceBadges family={family} />
        </span>
        <FamilyActions familyKey={family.key} name={family.name} />
      </div>
    </div>
  )
})
