import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GOOGLE_CATEGORIES,
  type GoogleCategory,
  type GoogleFamily,
  type InstallRecord,
  type LocalFamily,
  type Settings,
} from '@shared/types'
import { useUi } from '@/stores/ui'
import { useLocalFonts } from './useLocalFonts'

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function useCatalog() {
  return useQuery({ queryKey: ['gf-catalog'], queryFn: () => window.fontAPI.gfCatalog() })
}

// Kept fresh by syncQueries() in lib/live-queries.ts.
export function useInstalled() {
  return useQuery<InstallRecord[]>({
    queryKey: ['gf-installed'],
    queryFn: () => window.fontAPI.gfInstalled(),
  })
}

export function useUpdates() {
  return useQuery({ queryKey: ['gf-updates'], queryFn: () => window.fontAPI.gfUpdates() })
}

export function useSettings() {
  return useQuery<Settings>({ queryKey: ['settings'], queryFn: () => window.fontAPI.settingsGet() })
}

export function useGoogleInfo(family: string) {
  return useQuery({
    queryKey: ['gf-info', family],
    queryFn: () => window.fontAPI.gfInfo(family),
    staleTime: Infinity,
  })
}

export type InstallStatus = 'lettra' | 'local' | 'none'

// 'lettra' = we installed it, 'local' = installed some other way
// One lookup shared by every card, rebuilt only when either list actually changes.
const statusLookup = (() => {
  let last: {
    installed?: InstallRecord[]
    local?: LocalFamily[]
    status: (key: string) => InstallStatus
  } | null = null
  return (installed?: InstallRecord[], local?: LocalFamily[]): ((key: string) => InstallStatus) => {
    if (last && last.installed === installed && last.local === local) return last.status
    const own = new Set((installed ?? []).map((r) => r.key))
    const present = new Set((local ?? []).map((f) => f.key))
    const status = (key: string): InstallStatus =>
      own.has(key) ? 'lettra' : present.has(key) ? 'local' : 'none'
    last = { installed, local, status }
    return status
  }
})()

export function useInstallStatus(): (key: string) => InstallStatus {
  const { data: installed } = useInstalled()
  const { data: local } = useLocalFonts()
  return statusLookup(installed, local)
}

export interface GoogleView {
  families: GoogleFamily[]
  counts: Record<'all' | GoogleCategory, number>
  isPending: boolean
}

export function useGoogleFamilies(): GoogleView {
  const { data, isPending } = useCatalog()
  const category = useUi((s) => s.category)
  const updatesOnly = useUi((s) => s.updatesOnly)
  const { data: updates } = useUpdates()
  const sort = useUi((s) => s.sort)
  const query = useUi((s) => s.query)
  return useMemo(() => {
    const all = data?.families ?? []
    const counts = { all: all.length } as GoogleView['counts']
    for (const c of GOOGLE_CATEGORIES) counts[c] = all.filter((f) => f.category === c).length
    const q = fold(query.trim())
    const updatable = updatesOnly ? new Set((updates ?? []).map((u) => u.key)) : null
    const families = all.filter(
      (f) =>
        (!category || f.category === category) &&
        (!updatable || updatable.has(f.key)) &&
        (!q || fold(f.family).includes(q) || f.designers.some((d) => fold(d).includes(q))),
    )
    families.sort((a, b) =>
      sort === 'alpha'
        ? a.family.localeCompare(b.family)
        : sort === 'newest'
          ? b.dateAdded.localeCompare(a.dateAdded) || a.popularity - b.popularity
          : a.popularity - b.popularity,
    )
    return { families, counts, isPending }
  }, [data, isPending, category, updatesOnly, updates, sort, query])
}
