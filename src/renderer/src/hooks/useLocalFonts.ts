import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { LocalFamily, ScanStatus } from '@shared/types'

const LOCAL_FONTS_KEY = ['local-fonts'] as const

// Kept fresh by syncQueries() in lib/live-queries.ts.
export function useLocalFonts() {
  return useQuery<LocalFamily[]>({ queryKey: LOCAL_FONTS_KEY, queryFn: () => window.fontAPI.fontsList() })
}

export function useScanStatus(): ScanStatus | null {
  const [status, setStatus] = useState<ScanStatus | null>(null)
  useEffect(() => {
    let alive = true
    void window.fontAPI.fontsStatus().then((s) => alive && setStatus(s))
    const off = window.fontAPI.on('fonts:status', setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}
