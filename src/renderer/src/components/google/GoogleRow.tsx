import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { GoogleFamily } from '@shared/types'
import { defaultVariant } from '@/lib/google-loader'
import { googleSample } from '@/lib/sample-text'
import { familyMeta } from './GoogleCard'
import { FamilyActions } from '../browse/FamilyActions'
import { GooglePreview } from './GooglePreview'
import { InstallButton } from './InstallButton'

interface GoogleRowProps {
  family: GoogleFamily
  text: string
  size: number
  selected: boolean
  onOpen: (key: string, event?: { metaKey: boolean }) => void
}

export const GoogleRow = memo(function GoogleRow({ family, text, size, selected, onOpen }: GoogleRowProps) {
  const { t } = useTranslation()
  return (
    <div
      onClick={(e) => onOpen(family.key, e)}
      className={`group flex h-full w-full items-center gap-5 border-b border-line px-5 ${selected ? 'bg-accent-soft' : 'hover:bg-hover'}`}
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
        <span className="w-full truncate text-[13px] font-semibold">{family.family}</span>
        <span className="w-full truncate text-xs text-muted">{familyMeta(family, t)}</span>
      </button>
      <GooglePreview
        family={family}
        variant={defaultVariant(family)}
        text={googleSample(family, text)}
        size={size}
        className="min-w-0 flex-1 truncate leading-[1.25]"
      />
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
          {t(`category.${family.category}`)}
        </span>
        <InstallButton family={family} compact />
        <FamilyActions familyKey={family.key} name={family.family} />
      </div>
    </div>
  )
})
