import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FontCard } from '@/components/browse/FontCard'
import { FontRow } from '@/components/browse/FontRow'
import { VirtualGrid } from '@/components/browse/VirtualGrid'
import { VirtualList } from '@/components/browse/VirtualList'
import { CompareBar, CompareView } from '@/components/compare/Compare'
import { DetailDrawer } from '@/components/detail/DetailDrawer'
import { Dialogs } from '@/components/dialogs/Dialogs'
import { ConfirmDialog, DropOverlay, Toaster } from '@/components/feedback/Feedback'
import { GoogleCard } from '@/components/google/GoogleCard'
import { GoogleDrawer } from '@/components/google/GoogleDrawer'
import { GoogleRow } from '@/components/google/GoogleRow'
import { SortBar } from '@/components/google/SortBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toolbar } from '@/components/layout/Toolbar'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { UpdateDialog } from '@/components/update/UpdateDialog'
import { useDropInstall } from '@/hooks/useDropInstall'
import { useFamilies } from '@/hooks/useFamilies'
import { useCatalog, useGoogleFamilies, useUpdates } from '@/hooks/useGoogle'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useMixedView, useResolvedFamilies, type MixedFamily } from '@/hooks/useLibrary'
import { useLocalFonts, useScanStatus } from '@/hooks/useLocalFonts'
import { usePreview } from '@/stores/preview'
import { useUi } from '@/stores/ui'

function Message({
  children,
  action,
}: {
  children: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-[13px] whitespace-pre-line text-muted">
      <p className="m-0">{children}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="h-7 rounded-md border border-line-strong bg-card px-3 text-ink hover:bg-hover"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function App() {
  const { t } = useTranslation()
  const local = useFamilies()
  const google = useGoogleFamilies()
  const mixed = useMixedView()
  const { data: catalog } = useCatalog()
  const { data: localFonts } = useLocalFonts()
  // Both lists are in, so a key that doesn't resolve really is gone (uninstalled, removed).
  const loaded = Boolean(localFonts && catalog)
  const status = useScanStatus()
  const { text, size, view } = usePreview()
  const section = useUi((s) => s.section)
  const category = useUi((s) => s.category)
  const updatesOnly = useUi((s) => s.updatesOnly)
  const query = useUi((s) => s.query)
  const sort = useUi((s) => s.sort)
  const collectionId = useUi((s) => s.collectionId)
  // A new filter gets a fresh list that starts at the top, not the old list's scroll position.
  const listKey = [section, category, updatesOnly, collectionId, sort].join('|')
  const selected = useUi((s) => s.selected)
  const drawerOpen = useUi((s) => s.drawerOpen)
  const comparing = useUi((s) => s.comparing)
  const openDrawer = useUi((s) => s.openDrawer)
  const closeDrawer = useUi((s) => s.closeDrawer)
  const togglePin = useUi((s) => s.togglePin)
  // ⌘-click pins for comparison (the Mac multi-select gesture); a plain click opens the drawer.
  const openOrPin = useCallback(
    (key: string, event?: { metaKey: boolean }) => (event?.metaKey ? togglePin(key) : openDrawer(key)),
    [openDrawer, togglePin],
  )
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const setSection = useUi((s) => s.setSection)
  const dragging = useDropInstall()

  const isGoogle = section === 'google'
  const isMixed = section === 'favorites' || section === 'collection'
  const items: { key: string }[] = isGoogle ? google.families : isMixed ? mixed.items : local.families
  const isPending = isGoogle ? google.isPending : isMixed ? false : local.isPending

  const searchRef = useRef<HTMLInputElement>(null)
  const columnsRef = useRef(1)
  const onColumns = useCallback((columns: number) => {
    columnsRef.current = columns
  }, [])
  useKeyboardNav({ families: comparing ? [] : items, view, columnsRef, searchRef })

  // Commands from the app menu (⌘, ⌘1 ⌘2 and ⌘F are menu accelerators).
  useEffect(
    () =>
      window.fontAPI.on('app:command', (command) => {
        if (command === 'settings') setSettingsOpen(true)
        if (command === 'view-grid') usePreview.getState().setView('grid')
        if (command === 'view-list') usePreview.getState().setView('list')
        if (command === 'find') {
          searchRef.current?.focus()
          searchRef.current?.select()
        }
      }),
    [setSettingsOpen],
  )

  // The Updates view empties out once the last update is installed; go back to the catalog.
  const { data: updates } = useUpdates()
  const noUpdatesLeft = isGoogle && updatesOnly && updates?.length === 0
  useEffect(() => {
    if (noUpdatesLeft) useUi.getState().setSection('google')
  }, [noUpdatesLeft])

  const compareKeys = useUi((s) => s.compare)
  const pinned = useResolvedFamilies(compareKeys)
  const compareCount = pinned.length
  useEffect(() => {
    if (!loaded || pinned.length === compareKeys.length) return
    useUi.setState((s) => ({
      compare: pinned.map((f) => f.key),
      comparing: s.comparing && pinned.length > 0,
    }))
  }, [loaded, pinned, compareKeys])
  const title = comparing
    ? t('compare.title', { count: compareCount })
    : isGoogle && updatesOnly
      ? t('sidebar.updatesItem')
      : isGoogle
        ? category
          ? t(`category.${category}`)
          : t('sidebar.googleAll')
        : section === 'favorites'
          ? t('sidebar.favorites')
          : section === 'collection'
            ? (mixed.title ?? '')
            : t(`sidebar.${section}`)
  const total =
    isGoogle && updatesOnly
      ? google.families.length
      : isGoogle
        ? category
          ? google.counts[category]
          : google.counts.all
        : isMixed
          ? mixed.items.length
          : local.counts[section]

  const renderMixed = (f: MixedFamily, sel: boolean, row: boolean): ReactNode => {
    const props = { text, size, selected: sel, onOpen: openOrPin }
    if (f.local)
      return row ? <FontRow family={f.local} {...props} /> : <FontCard family={f.local} {...props} />
    return row ? <GoogleRow family={f.google!} {...props} /> : <GoogleCard family={f.google!} {...props} />
  }

  let content: ReactNode
  if (comparing) content = <CompareView />
  else if (isPending) content = <Message>{isGoogle ? t('google.loading') : t('browse.scanning')}</Message>
  else if (!items.length)
    content = (
      <Message
        action={
          query
            ? isGoogle
              ? { label: t('browse.searchLibrary', { query }), onClick: () => setSection('all') }
              : { label: t('browse.searchGoogle', { query }), onClick: () => setSection('google') }
            : undefined
        }
      >
        {query
          ? t('browse.noResults', { query })
          : section === 'favorites'
            ? t('favorites.empty')
            : section === 'collection'
              ? t('collections.emptyView')
              : t('browse.empty')}
      </Message>
    )
  else if (isGoogle)
    content =
      view === 'grid' ? (
        <VirtualGrid
          key={listKey}
          scrollKey={query}
          items={google.families}
          size={size}
          selected={selected}
          onColumns={onColumns}
          renderItem={(f, sel) => (
            <GoogleCard family={f} text={text} size={size} selected={sel} onOpen={openOrPin} />
          )}
        />
      ) : (
        <VirtualList
          key={listKey}
          scrollKey={query}
          items={google.families}
          size={size}
          selected={selected}
          renderItem={(f, sel) => (
            <GoogleRow family={f} text={text} size={size} selected={sel} onOpen={openOrPin} />
          )}
        />
      )
  else if (isMixed)
    content =
      view === 'grid' ? (
        <VirtualGrid
          key={listKey}
          scrollKey={query}
          items={mixed.items}
          size={size}
          selected={selected}
          onColumns={onColumns}
          renderItem={(f, sel) => renderMixed(f, sel, false)}
        />
      ) : (
        <VirtualList
          key={listKey}
          scrollKey={query}
          items={mixed.items}
          size={size}
          selected={selected}
          renderItem={(f, sel) => renderMixed(f, sel, true)}
        />
      )
  else
    content =
      view === 'grid' ? (
        <VirtualGrid
          key={listKey}
          scrollKey={query}
          items={local.families}
          size={size}
          selected={selected}
          onColumns={onColumns}
          renderItem={(f, sel) => (
            <FontCard family={f} text={text} size={size} selected={sel} onOpen={openOrPin} />
          )}
        />
      ) : (
        <VirtualList
          key={listKey}
          scrollKey={query}
          items={local.families}
          size={size}
          selected={selected}
          renderItem={(f, sel) => (
            <FontRow family={f} text={text} size={size} selected={sel} onOpen={openOrPin} />
          )}
        />
      )

  // The drawer shows the installed family when there is one, else the Google entry.
  const subjectKeys = useMemo(
    () => (drawerOpen && selected && !comparing ? [selected] : []),
    [drawerOpen, selected, comparing],
  )
  const [subject] = useResolvedFamilies(subjectKeys)
  const localDrawer = !isGoogle ? subject?.local : undefined
  const googleDrawer = !localDrawer ? subject?.google : undefined
  const drawerGone = loaded && drawerOpen && !comparing && Boolean(selected) && !localDrawer && !googleDrawer
  useEffect(() => {
    if (!drawerGone) return
    closeDrawer()
    useUi.getState().select(null)
  }, [drawerGone, closeDrawer])

  return (
    <div className="flex h-full">
      <Sidebar localCounts={local.counts} googleCounts={catalog ? google.counts : null} />
      <main className="flex min-w-0 flex-1 flex-col bg-surface">
        <Toolbar title={title} total={total} status={status} searchRef={searchRef} comparing={comparing} />
        {isGoogle && !comparing && <SortBar origin={catalog?.origin} />}
        {content}
        {!comparing && <CompareBar />}
      </main>
      {localDrawer && <DetailDrawer key={localDrawer.key} family={localDrawer} onClose={closeDrawer} />}
      {googleDrawer && <GoogleDrawer key={googleDrawer.key} family={googleDrawer} onClose={closeDrawer} />}
      <Dialogs />
      <ConfirmDialog />
      <SettingsDialog />
      <UpdateDialog />
      <Toaster />
      {dragging && <DropOverlay />}
    </div>
  )
}
