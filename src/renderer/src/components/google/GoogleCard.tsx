import { memo } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { GoogleFamily } from '@shared/types'
import { defaultVariant } from '@/lib/google-loader'
import { googleSample } from '@/lib/sample-text'
import { cardHeight, cardPreviewHeight, previewLineHeight } from '../browse/layout'
import { FamilyActions } from '../browse/FamilyActions'
import { GooglePreview } from './GooglePreview'
import { InstallButton } from './InstallButton'

interface GoogleCardProps {
  family: GoogleFamily
  text: string
  size: number
  selected: boolean
  onOpen: (key: string, event?: { metaKey: boolean }) => void
}

export function familyMeta(family: GoogleFamily, t: TFunction): string {
  const styles = t('browse.styles', { count: family.variants.length })
  return family.designers.length ? `${family.designers[0]} · ${styles}` : styles
}

// div, not button: it contains the Install button. The name is the focusable control.
export const GoogleCard = memo(function GoogleCard({
  family,
  text,
  size,
  selected,
  onOpen,
}: GoogleCardProps) {
  const { t } = useTranslation()
  return (
    <div
      onClick={(e) => onOpen(family.key, e)}
      style={{ height: cardHeight(size) }}
      className={`group flex w-full cursor-default flex-col gap-3.5 overflow-hidden rounded-[10px] border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] ${
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
          <span className="w-full truncate text-[13px] font-semibold">{family.family}</span>
          <span className="w-full truncate text-xs text-muted">{familyMeta(family, t)}</span>
        </button>
        <FamilyActions familyKey={family.key} name={family.family} />
      </div>
      <GooglePreview
        family={family}
        variant={defaultVariant(family)}
        text={googleSample(family, text)}
        size={size}
        className="line-clamp-2 w-full overflow-hidden break-words"
        style={{ height: cardPreviewHeight(size), lineHeight: `${previewLineHeight(size)}px` }}
      />
      <div className="flex h-[22px] w-full items-center gap-1.5">
        <span className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-muted">
          {t(`category.${family.category}`)}
        </span>
        <span className="flex-1" />
        <InstallButton family={family} />
      </div>
    </div>
  )
})
