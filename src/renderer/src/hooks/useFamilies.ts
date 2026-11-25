import { useMemo } from 'react'
import type { LocalFamily } from '@shared/types'
import { inSection, matches } from '@/lib/families'
import { useUi, type LocalSection } from '@/stores/ui'
import { useLocalFonts } from './useLocalFonts'

export interface FamiliesView {
  families: LocalFamily[]
  counts: Record<LocalSection, number>
  isPending: boolean
}

export function useFamilies(): FamiliesView {
  const { data, isPending } = useLocalFonts()
  const section = useUi((s) => s.section)
  const query = useUi((s) => s.query)
  return useMemo(() => {
    const all = (data ?? []).filter((f) => !f.hidden)
    const counts: Record<LocalSection, number> = {
      all: all.length,
      user: all.filter((f) => inSection(f, 'user')).length,
      system: all.filter((f) => inSection(f, 'system')).length,
    }
    const local = section === 'all' || section === 'user' || section === 'system' ? section : null
    const families = local ? all.filter((f) => inSection(f, local) && matches(f, query)) : []
    return { families, counts, isPending }
  }, [data, isPending, section, query])
}
