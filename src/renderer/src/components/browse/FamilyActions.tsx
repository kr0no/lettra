import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Columns2, Heart } from 'lucide-react'
import { useLibrary } from '@/hooks/useLibrary'
import { MAX_COMPARE, useUi } from '@/stores/ui'

const stop = (e: MouseEvent): void => e.stopPropagation()

// Favorite + compare pin. The pin only shows on hover unless `persistent` (drawers).
export function FamilyActions({
  familyKey,
  name,
  size = 15,
  persistent = false,
}: {
  familyKey: string
  name: string
  size?: number
  persistent?: boolean
}) {
  const { t } = useTranslation()
  const favorite = useLibrary().favorites.includes(familyKey)
  const pinned = useUi((s) => s.compare.includes(familyKey))
  const full = useUi((s) => s.compare.length >= MAX_COMPARE)
  const togglePin = useUi((s) => s.togglePin)
  const button = 'no-drag grid size-7 shrink-0 place-items-center rounded-md hover:bg-hover'

  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        aria-pressed={pinned}
        disabled={!pinned && full}
        aria-label={t(pinned ? 'compare.unpin' : 'compare.pin', { name })}
        title={
          !pinned && full
            ? t('compare.full', { count: MAX_COMPARE })
            : t(pinned ? 'compare.unpin' : 'compare.pinTip', { name })
        }
        onClick={(e) => {
          stop(e)
          togglePin(familyKey)
        }}
        className={`${button} disabled:opacity-40 ${pinned ? 'text-accent' : persistent ? 'text-muted hover:text-ink' : 'text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
      >
        <Columns2 size={size - 1} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={t(favorite ? 'favorites.remove' : 'favorites.add', { name })}
        title={t(favorite ? 'favorites.remove' : 'favorites.add', { name })}
        onClick={(e) => {
          stop(e)
          void window.fontAPI.libraryToggleFavorite(familyKey)
        }}
        className={`${button} ${favorite ? 'text-favorite' : 'text-muted'}`}
      >
        <Heart size={size} strokeWidth={1.75} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </span>
  )
}
