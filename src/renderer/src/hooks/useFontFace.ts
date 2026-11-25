import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { LocalFace } from '@shared/types'
import {
  getSnapshot,
  requestLocalFace,
  subscribe,
  retainLocalFace,
  type FaceSnapshot,
} from '@/lib/font-loader'

const PENDING: FaceSnapshot = { family: '', state: 'loading' }

/** Loads a face when `enabled` (e.g. its card is visible) and returns its CSS alias and load state. */
export function useLocalFontFace(face: LocalFace | undefined, enabled = true): FaceSnapshot {
  const id = face?.id
  const read = useCallback(() => (id ? getSnapshot(id) : undefined), [id])
  const entry = useSyncExternalStore(subscribe, read)
  const missing = entry === undefined
  // Loads it if needed and holds on to it while this component shows it.
  useEffect(() => {
    if (!face || !enabled) return
    if (missing) requestLocalFace(face)
    return retainLocalFace(face.id)
  }, [face, enabled, missing])
  return entry ?? PENDING
}
