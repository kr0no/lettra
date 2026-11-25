import { faceUrl } from '@shared/ipc-contract'
import type { LocalFace } from '@shared/types'

export type LoadState = 'loading' | 'ready' | 'unavailable'

export interface FaceSnapshot {
  /** Private CSS family alias the face is registered under. */
  family: string
  state: LoadState
}

interface Entry {
  snapshot: FaceSnapshot
  face: FontFace | null
  /** Components showing this face right now; never evicted while above 0. */
  users: number
  bytes: number
}

/** Keep at most this many preview faces, and roughly this many bytes, registered in document.fonts. */
const MAX_LOADED = 400
const MAX_BYTES = 300 * 1024 * 1024
const entries = new Map<string, Entry>()
let loadedBytes = 0
const listeners = new Set<() => void>()

const notify = (): void => listeners.forEach((l) => l())

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(faceId: string): FaceSnapshot | undefined {
  return entries.get(faceId)?.snapshot
}

// Oldest first. Anything still on screen sees its entry vanish and asks for it again.
// React runs every effect cleanup of a commit before the new effects, so visible faces
// briefly have no users. Evicting after the commit keeps them from being dropped.
let evictQueued = false
function scheduleEvict(): void {
  if (evictQueued) return
  evictQueued = true
  queueMicrotask(() => {
    evictQueued = false
    evict()
  })
}

function evict(): void {
  let evicted = false
  for (const [id, entry] of entries) {
    if (entries.size <= MAX_LOADED && loadedBytes <= MAX_BYTES) break
    if (entry.snapshot.state === 'loading' || entry.users > 0) continue
    if (entry.face) document.fonts.delete(entry.face)
    entries.delete(id)
    loadedBytes -= entry.bytes
    evicted = true
  }
  if (evicted) notify()
}

async function tryLoad(alias: string, source: string): Promise<FontFace | null> {
  try {
    const ff = new FontFace(alias, source)
    await ff.load()
    document.fonts.add(ff)
    return ff
  } catch {
    return null
  }
}

// Each face gets a private alias so it can't collide with an installed font of the same name.
// Tries lettra-font:// first, then local("<PostScriptName>"), else marks it unavailable.
/** Marks a face as in use (and recently used). Call the returned function when it's off screen. */
export function retainLocalFace(id: string): () => void {
  const entry = entries.get(id)
  if (!entry) return () => undefined
  entries.delete(id)
  entries.set(id, entry)
  entry.users++
  return () => {
    entry.users--
  }
}

export function requestLocalFace(face: LocalFace): void {
  if (entries.has(face.id)) return
  const alias = `lettra-l-${face.id}`
  const entry: Entry = {
    snapshot: { family: alias, state: 'loading' },
    face: null,
    users: 0,
    bytes: face.fileSize,
  }
  loadedBytes += entry.bytes
  entries.set(face.id, entry)
  scheduleEvict()
  void (async () => {
    entry.face =
      (await tryLoad(alias, `url("${faceUrl(face.id)}")`)) ??
      (face.postscriptName.startsWith('.') ? null : await tryLoad(alias, `local("${face.postscriptName}")`))
    entry.snapshot = { family: alias, state: entry.face ? 'ready' : 'unavailable' }
    if (!entry.face) {
      // Nothing was loaded, so it shouldn't count against the budget.
      loadedBytes -= entry.bytes
      entry.bytes = 0
    }
    notify()
  })()
}
