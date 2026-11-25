import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, FolderPlus, Plus } from 'lucide-react'
import { useLibrary } from '@/hooks/useLibrary'

/** "Add to collection" popover: toggle membership in each collection, or create one with this family. */
export function CollectionMenu({ familyKey }: { familyKey: string }) {
  const { t } = useTranslation()
  const { collections } = useLibrary()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const create = async (): Promise<void> => {
    if (!name.trim()) return
    await window.fontAPI.libraryCollectionCreate(name, [familyKey])
    setName('')
  }

  return (
    <div ref={ref} className="no-drag relative">
      <button
        type="button"
        aria-expanded={open}
        title={t('collections.addTo')}
        aria-label={t('collections.addTo')}
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
      >
        <FolderPlus size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="group"
          aria-label={t('collections.addTo')}
          className="no-drag absolute top-8 right-0 z-20 flex w-60 flex-col gap-0.5 rounded-lg border border-line bg-card p-1.5 shadow-xl"
        >
          <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold text-muted">
            {t('collections.addTo')}
          </div>
          {collections.length === 0 && (
            <div className="px-2 pb-1 text-xs text-muted">{t('collections.none')}</div>
          )}
          {collections.map((c) => {
            const member = c.familyKeys.includes(familyKey)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={member}
                onClick={() =>
                  void (member
                    ? window.fontAPI.libraryCollectionRemove(c.id, [familyKey])
                    : window.fontAPI.libraryCollectionAdd(c.id, [familyKey]))
                }
                className="flex min-h-7 items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover"
              >
                <span className="grid w-4 place-items-center text-accent">
                  {member && <Check size={13} strokeWidth={2.25} />}
                </span>
                <span className="flex-1 truncate">{c.name}</span>
              </button>
            )
          })}
          <form
            className="mt-1 flex items-center gap-1 border-t border-line pt-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
          >
            <label className="flex h-7 flex-1 items-center rounded-md bg-field px-2 focus-within:[outline:2px_solid_var(--accent)] focus-within:[outline-offset:1px]">
              <span className="sr-only">{t('collections.newName')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('collections.newPlaceholder')}
                maxLength={80}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
              />
            </label>
            <button
              type="submit"
              aria-label={t('collections.create')}
              disabled={!name.trim()}
              className="grid size-7 place-items-center rounded-md text-accent hover:bg-hover disabled:opacity-40"
            >
              <Plus size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
