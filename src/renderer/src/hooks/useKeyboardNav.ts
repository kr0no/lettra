import { useEffect, type RefObject } from 'react'
import type { ViewMode } from '@shared/types'
import { useUi } from '@/stores/ui'

interface Options {
  families: { key: string }[]
  view: ViewMode
  /** Current grid column count (1 in list view). */
  columnsRef: RefObject<number>
  searchRef: RefObject<HTMLInputElement | null>
}

const isTextField = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range') ||
    el.isContentEditable)

// Sliders and selects use the arrow keys themselves.
const usesArrows = (el: EventTarget | null): boolean =>
  isTextField(el) ||
  (el instanceof HTMLInputElement && el.type === 'range') ||
  (el instanceof HTMLElement && el.tagName === 'SELECT')

/**
 * Moves focus to the newly selected card once the virtualizer has rendered it
 * (it may need a render or two after scrolling). Timers, not rAF, because rAF
 * pauses while the window is occluded.
 */
function focusFamily(key: string, attempt = 0): void {
  setTimeout(() => {
    const el = document.getElementById(`family-${key}`)
    if (el) el.focus({ preventScroll: true })
    else if (attempt < 10) focusFamily(key, attempt + 1)
  }, 16)
}

// Arrows move the selection (by row/column in the grid), Home/End jump,
// Enter/Space open the drawer, Escape closes it and then clears the selection.
export function useKeyboardNav({ families, view, columnsRef, searchRef }: Options): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ui = useUi.getState()

      if (e.metaKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'Escape') {
        if (isTextField(e.target)) return // the field handles its own Escape
        if (document.querySelector('dialog[open]')) return // the dialog closes itself
        if (ui.comparing) ui.setComparing(false)
        else if (ui.drawerOpen) ui.closeDrawer()
        else ui.select(null)
        return
      }
      if (usesArrows(e.target) || document.querySelector('dialog[open]')) return

      // A focused card is a <button>: let Enter/Space click it natively.
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement) return
      if (e.key === 'Enter' || e.key === ' ') {
        // The selection can be filtered out of the list; don't open a drawer for something not shown.
        if (ui.selected && families.some((f) => f.key === ui.selected)) {
          e.preventDefault()
          ui.toggleDrawer()
        }
        return
      }

      const columns = view === 'grid' ? Math.max(1, columnsRef.current ?? 1) : 1
      const delta: Record<string, number> = {
        ArrowRight: view === 'grid' ? 1 : 0,
        ArrowLeft: view === 'grid' ? -1 : 0,
        ArrowDown: columns,
        ArrowUp: -columns,
      }
      if (!(e.key in delta) && e.key !== 'Home' && e.key !== 'End') return
      if (!families.length) return
      e.preventDefault()

      // Start from the card that has focus (Tab moves focus, not the selection), else the selection.
      const focused = document.activeElement?.id.startsWith('family-')
        ? document.activeElement.id.slice(7)
        : null
      const from = focused ?? ui.selected
      const current = from ? families.findIndex((f) => f.key === from) : -1
      let next: number
      if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = families.length - 1
      else if (current < 0) next = 0
      else next = Math.min(families.length - 1, Math.max(0, current + (delta[e.key] ?? 0)))

      const key = families[next]!.key
      ui.select(key)
      focusFamily(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [families, view, columnsRef, searchRef])
}
