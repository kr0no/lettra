import { create } from 'zustand'
import type { FamilyKey, GoogleCategory } from '@shared/types'

export type Section = 'all' | 'user' | 'system' | 'google' | 'favorites' | 'collection'
export type LocalSection = 'all' | 'user' | 'system'
export type GoogleSort = 'popular' | 'newest' | 'alpha'

export const MAX_COMPARE = 4

interface UiState {
  section: Section
  /** Google category filter; null = all families. Only used in the google section. */
  category: GoogleCategory | null
  /** Google section filtered to installed families with an update. */
  updatesOnly: boolean
  /** Open collection when section is 'collection'. */
  collectionId: string | null
  sort: GoogleSort
  query: string
  /** Family highlighted in the grid/list (keyboard focus and drawer subject). */
  selected: FamilyKey | null
  drawerOpen: boolean
  /** Families pinned for side-by-side comparison (local or Google), in pin order. */
  compare: FamilyKey[]
  comparing: boolean
  settingsOpen: boolean
  setSection: (
    section: Section,
    options?: { category?: GoogleCategory | null; collectionId?: string | null; updates?: boolean },
  ) => void
  setSort: (sort: GoogleSort) => void
  setQuery: (query: string) => void
  select: (key: FamilyKey | null) => void
  openDrawer: (key: FamilyKey) => void
  toggleDrawer: () => void
  closeDrawer: () => void
  togglePin: (key: FamilyKey) => void
  clearCompare: () => void
  setComparing: (on: boolean) => void
  setSettingsOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  section: 'all',
  category: null,
  updatesOnly: false,
  collectionId: null,
  sort: 'popular',
  query: '',
  selected: null,
  drawerOpen: false,
  compare: [],
  comparing: false,
  settingsOpen: false,
  setSection: (section, options = {}) =>
    set({
      section,
      category: options.category ?? null,
      updatesOnly: options.updates ?? false,
      collectionId: options.collectionId ?? null,
      selected: null,
      drawerOpen: false,
      comparing: false,
    }),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  select: (selected) => set({ selected }),
  openDrawer: (key) => set({ selected: key, drawerOpen: true }),
  toggleDrawer: () => set((s) => ({ drawerOpen: s.selected ? !s.drawerOpen : false })),
  closeDrawer: () => set({ drawerOpen: false }),
  togglePin: (key) =>
    set((s) => {
      if (s.compare.includes(key)) {
        const compare = s.compare.filter((k) => k !== key)
        return { compare, comparing: s.comparing && compare.length > 0 }
      }
      return s.compare.length >= MAX_COMPARE ? s : { compare: [...s.compare, key] }
    }),
  clearCompare: () => set({ compare: [], comparing: false }),
  setComparing: (comparing) => set((s) => ({ comparing, drawerOpen: comparing ? false : s.drawerOpen })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))
