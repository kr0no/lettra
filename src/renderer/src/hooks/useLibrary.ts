import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GoogleFamily, Library, LocalFamily } from '@shared/types'
import { matches } from '@/lib/families'
import { useUi } from '@/stores/ui'
import { useCatalog } from './useGoogle'
import { useLocalFonts } from './useLocalFonts'

const EMPTY: Library = { favorites: [], collections: [] }

export function useLibrary(): Library {
  return (
    useQuery<Library>({ queryKey: ['library'], queryFn: () => window.fontAPI.libraryGet() }).data ?? EMPTY
  )
}

/** A family key resolved to whatever is available: the installed family, the Google entry, or both. */
export interface MixedFamily {
  key: string
  name: string
  local?: LocalFamily
  google?: GoogleFamily
}

/** Resolves keys (favorites, a collection, compare pins) to families, in the given order. */
export function useResolvedFamilies(keys: string[]): MixedFamily[] {
  const { data: local } = useLocalFonts()
  const { data: catalog } = useCatalog()
  return useMemo(() => {
    const localByKey = new Map((local ?? []).map((f) => [f.key, f]))
    const googleByKey = new Map((catalog?.families ?? []).map((f) => [f.key, f]))
    return keys.flatMap((key) => {
      const l = localByKey.get(key)
      const g = googleByKey.get(key)
      if (!l && !g) return []
      return [{ key, name: l?.name ?? g!.family, ...(l ? { local: l } : {}), ...(g ? { google: g } : {}) }]
    })
  }, [keys, local, catalog])
}

/**
 * Keys that still resolve to a family. A collection keeps the key of a font
 * that was removed (it comes back if the font does), but it shouldn't be counted.
 */
export function useKnownKeys(): Set<string> | null {
  const { data: local } = useLocalFonts()
  const { data: catalog } = useCatalog()
  return useMemo(
    () =>
      local && catalog ? new Set([...local.map((f) => f.key), ...catalog.families.map((f) => f.key)]) : null,
    [local, catalog],
  )
}

/** Before both lists load, every key counts. */
export const knownCount = (keys: string[], known: Set<string> | null): number =>
  known ? keys.filter((k) => known.has(k)).length : keys.length

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function useMixedView(): { items: MixedFamily[]; title: string | null } {
  const lib = useLibrary()
  const section = useUi((s) => s.section)
  const collectionId = useUi((s) => s.collectionId)
  const query = useUi((s) => s.query)
  const collection = section === 'collection' ? lib.collections.find((c) => c.id === collectionId) : undefined
  const keys = section === 'favorites' ? lib.favorites : (collection?.familyKeys ?? [])
  const resolved = useResolvedFamilies(keys)
  const items = useMemo(() => {
    const q = fold(query.trim())
    return resolved
      .filter((f) => !q || (f.local ? matches(f.local, query) : fold(f.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [resolved, query])
  return { items, title: collection?.name ?? null }
}
