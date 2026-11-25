import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CircleArrowDown,
  Folder,
  Globe,
  HardDrive,
  Heart,
  Library,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  UserRound,
} from 'lucide-react'
import { GOOGLE_CATEGORIES, type Collection, type GoogleCategory } from '@shared/types'
import { useUpdates } from '@/hooks/useGoogle'
import { knownCount, useKnownKeys, useLibrary } from '@/hooks/useLibrary'
import { useFeedback } from '@/stores/feedback'
import { useUi, type LocalSection } from '@/stores/ui'
import { useUpdate } from '@/stores/update'

interface SidebarProps {
  localCounts: Record<LocalSection, number>
  googleCounts: Record<'all' | GoogleCategory, number> | null
}

interface ItemProps {
  active: boolean
  icon?: ReactNode
  label: string
  count?: number | string
  onClick: () => void
  /** Double-click or F2. */
  onRename?: () => void
  id?: string
  title?: string
  trailing?: ReactNode
}

function Item({ active, icon, label, count, onClick, onRename, id, title, trailing }: ItemProps) {
  return (
    <div
      className={`group/item flex min-h-7 items-center rounded-md ${active ? 'bg-accent-soft' : 'hover:bg-hover'}`}
    >
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        id={id}
        title={title}
        onClick={onClick}
        onDoubleClick={onRename}
        onKeyDown={(e) => {
          if (e.key === 'F2' && onRename) {
            e.preventDefault()
            onRename()
          }
        }}
        className={`flex min-h-7 min-w-0 flex-1 items-center gap-2 px-2 text-left ${active ? 'font-semibold text-accent-ink' : ''}`}
      >
        {icon && <span className={active ? 'text-accent' : 'text-muted'}>{icon}</span>}
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && (
          <span className={`tabular-nums ${active ? 'text-accent-ink' : 'text-muted'}`}>{count}</span>
        )}
      </button>
      {trailing}
    </div>
  )
}

const Heading = ({ children, action }: { children: string; action?: ReactNode }) => (
  <div className="flex items-center justify-between px-2 pb-1">
    <span className="text-[11px] font-semibold text-muted">{children}</span>
    {action}
  </div>
)

/** Inline text field for creating or renaming a collection. Enter saves, Escape cancels. */
function NameField({
  initial,
  onSave,
  onCancel,
  label,
}: {
  initial: string
  onSave: (name: string) => void
  onCancel: () => void
  label: string
}) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  // Enter saves directly (not via blur), so it works even if the field never had focus.
  const commit = (save: boolean): void => {
    if (done.current) return
    done.current = true
    if (save && value.trim() && value !== initial) onSave(value)
    else onCancel()
  }
  return (
    <label className="flex min-h-7 items-center rounded-md bg-field px-2 focus-within:[outline:2px_solid_var(--accent)] focus-within:[outline-offset:1px]">
      <span className="sr-only">{label}</span>
      <input
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the field appears because the user just asked to type a name
        autoFocus
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(true)
          if (e.key === 'Escape') commit(false)
        }}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
    </label>
  )
}

export function Sidebar({ localCounts, googleCounts }: SidebarProps) {
  const { t, i18n } = useTranslation()
  const section = useUi((s) => s.section)
  const category = useUi((s) => s.category)
  const updatesOnly = useUi((s) => s.updatesOnly)
  const collectionId = useUi((s) => s.collectionId)
  const setSection = useUi((s) => s.setSection)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const appUpdate = useUpdate((s) => s.update)
  const openUpdate = useUpdate((s) => s.setDialogOpen)
  const ask = useFeedback((s) => s.ask)
  const { favorites, collections } = useLibrary()
  const known = useKnownKeys()
  const { data: updates } = useUpdates()
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const fmt = (n: number | undefined): string | undefined =>
    n === undefined ? undefined : n.toLocaleString(i18n.language)

  const local: { section: LocalSection; icon: ReactNode }[] = [
    { section: 'all', icon: <Library size={15} strokeWidth={1.75} /> },
    { section: 'user', icon: <UserRound size={15} strokeWidth={1.75} /> },
    { section: 'system', icon: <HardDrive size={15} strokeWidth={1.75} /> },
  ]

  // Back to the item it renamed, not to <body>.
  const stopRenaming = (id: string): void => {
    setRenaming(null)
    requestAnimationFrame(() => document.getElementById(`collection-${id}`)?.focus())
  }

  const deleteCollection = (c: Collection): void =>
    ask({
      title: t('collections.deleteTitle', { name: c.name }),
      body: t('collections.deleteBody'),
      confirmLabel: t('collections.delete'),
      danger: true,
      onConfirm: async () => {
        await window.fontAPI.libraryCollectionDelete(c.id)
        if (collectionId === c.id) setSection('all')
      },
    })

  return (
    <nav aria-label={t('sidebar.library')} className="flex w-[232px] shrink-0 flex-col bg-sidebar">
      {/* traffic lights are at (18, 18), keep the wordmark below them */}
      <div className="drag flex h-[76px] shrink-0 items-end px-4.5">
        <span
          className="text-[24px] leading-none tracking-tight"
          style={{ fontFamily: "'New York', 'Iowan Old Style', Georgia, serif" }}
        >
          Lettra
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 pt-4 pb-3">
        <div className="flex flex-col gap-0.5">
          <Heading>{t('sidebar.library')}</Heading>
          {local.map((item) => (
            <Item
              key={item.section}
              active={section === item.section}
              icon={item.icon}
              label={t(`sidebar.${item.section}`)}
              count={fmt(localCounts[item.section])}
              onClick={() => setSection(item.section)}
            />
          ))}
          <Item
            active={section === 'favorites'}
            icon={<Heart size={15} strokeWidth={1.75} />}
            label={t('sidebar.favorites')}
            count={fmt(knownCount(favorites, known))}
            onClick={() => setSection('favorites')}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <Heading
            action={
              <button
                type="button"
                aria-label={t('collections.new')}
                title={t('collections.new')}
                onClick={() => setCreating(true)}
                className="grid size-5 place-items-center rounded text-muted hover:bg-hover hover:text-ink"
              >
                <Plus size={13} />
              </button>
            }
          >
            {t('sidebar.collections')}
          </Heading>
          {collections.map((c) =>
            renaming === c.id ? (
              <NameField
                key={c.id}
                label={t('collections.rename')}
                initial={c.name}
                onSave={(name) => {
                  stopRenaming(c.id)
                  void window.fontAPI.libraryCollectionRename(c.id, name)
                }}
                onCancel={() => stopRenaming(c.id)}
              />
            ) : (
              <Item
                key={c.id}
                active={section === 'collection' && collectionId === c.id}
                icon={<Folder size={15} strokeWidth={1.75} />}
                label={c.name}
                count={fmt(knownCount(c.familyKeys, known))}
                onClick={() => setSection('collection', { collectionId: c.id })}
                id={`collection-${c.id}`}
                title={t('collections.renameHint')}
                onRename={() => setRenaming(c.id)}
                trailing={
                  <button
                    type="button"
                    aria-label={t('collections.deleteTitle', { name: c.name })}
                    title={t('collections.delete')}
                    onClick={() => deleteCollection(c)}
                    className="mr-1 grid size-6 shrink-0 place-items-center rounded text-muted opacity-0 group-hover/item:opacity-100 hover:text-ink focus-visible:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                }
              />
            ),
          )}
          {creating && (
            <NameField
              label={t('collections.newName')}
              initial=""
              onSave={(name) => {
                setCreating(false)
                void window.fontAPI.libraryCollectionCreate(name, [])
              }}
              onCancel={() => setCreating(false)}
            />
          )}
          {!collections.length && !creating && (
            <p className="m-0 px-2 text-xs text-muted">{t('collections.empty')}</p>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <Heading>{t('sidebar.google')}</Heading>
          <Item
            active={section === 'google' && category === null && !updatesOnly}
            icon={<Globe size={15} strokeWidth={1.75} />}
            label={t('sidebar.googleAll')}
            count={fmt(googleCounts?.all)}
            onClick={() => setSection('google')}
          />
          {GOOGLE_CATEGORIES.map((c) => (
            <Item
              key={c}
              active={section === 'google' && category === c}
              icon={<span className="inline-block w-[15px]" />}
              label={t(`category.${c}`)}
              count={fmt(googleCounts?.[c])}
              onClick={() => setSection('google', { category: c })}
            />
          ))}
          {updates && updates.length > 0 && (
            <Item
              active={section === 'google' && updatesOnly}
              icon={<RefreshCw size={15} strokeWidth={1.75} className="text-accent" />}
              label={t('sidebar.updatesItem')}
              count={fmt(updates.length)}
              onClick={() => setSection('google', { updates: true })}
            />
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-2.5 py-2">
        {appUpdate && (
          <button
            type="button"
            onClick={() => openUpdate(true)}
            className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 text-left text-accent-ink hover:bg-hover"
          >
            <CircleArrowDown size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
            <span className="flex-1 truncate">{t('update.available', { version: appUpdate.version })}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 text-left text-muted hover:bg-hover hover:text-ink"
        >
          <Settings size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('settings.title')}
        </button>
      </div>
    </nav>
  )
}
