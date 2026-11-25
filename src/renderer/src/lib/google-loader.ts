import type { GoogleFamily } from '@shared/types'
import type { FaceSnapshot } from './font-loader'

// Google previews live in memory only. Each woff2 subset keeps its unicode-range,
// so Chromium only downloads the subsets the text actually uses.

interface Entry {
  snapshot: FaceSnapshot
  faces: FontFace[]
  /** Previews showing this entry right now; never evicted while above 0. */
  users: number
}

const MAX_ENTRIES = 300
const MAX_CONCURRENT = 6
const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
/** Most recent requests first: when scrolling fast, the cards on screen now win. */
const queue: (() => Promise<void>)[] = []
let running = 0

const notify = (): void => listeners.forEach((l) => l())

export function subscribeGoogle(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGoogleSnapshot(id: string): FaceSnapshot | undefined {
  return entries.get(id)?.snapshot
}

export const variantWeight = (variant: string): number => Number.parseInt(variant, 10) || 400
export const variantStyle = (variant: string): 'normal' | 'italic' =>
  variant.endsWith('i') ? 'italic' : 'normal'
export const googleAlias = (family: GoogleFamily): string =>
  `lettra-g-${family.key.replace(/[^a-z0-9]+/g, '-')}`
export const googleEntryId = (family: GoogleFamily, variant: string): string => `${family.family}|${variant}`

/** The variant cards show: regular if there is one, else the closest upright weight. */
export function defaultVariant(family: GoogleFamily): string {
  if (family.variants.includes('400')) return '400'
  const upright = family.variants.filter((v) => !v.endsWith('i'))
  const pool = upright.length ? upright : family.variants
  return pool.reduce(
    (best, v) => (Math.abs(variantWeight(v) - 400) < Math.abs(variantWeight(best) - 400) ? v : best),
    pool[0] ?? '400',
  )
}

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length) {
    const job = queue.pop()!
    running++
    void job().finally(() => {
      running--
      pump()
    })
  }
}

// Oldest first. Anything still on screen sees its entry vanish and asks for it again.
function evict(): void {
  let evicted = false
  for (const [id, entry] of entries) {
    if (entries.size <= MAX_ENTRIES) break
    if (entry.snapshot.state === 'loading' || entry.users > 0) continue
    for (const f of entry.faces) document.fonts.delete(f)
    entries.delete(id)
    evicted = true
  }
  if (evicted) notify()
}

/** Marks a preview as in use (and recently used). Call the returned function when it's off screen. */
export function retainGoogleFace(id: string): () => void {
  const entry = entries.get(id)
  if (!entry) return () => undefined
  entries.delete(id)
  entries.set(id, entry)
  entry.users++
  return () => {
    entry.users--
  }
}

export function requestGoogleFace(family: GoogleFamily, variant: string, sample: string): void {
  const id = googleEntryId(family, variant)
  const existing = entries.get(id)
  if (existing) {
    entries.delete(id)
    entries.set(id, existing)
    return
  }
  const alias = googleAlias(family)
  const entry: Entry = { snapshot: { family: alias, state: 'loading' }, faces: [], users: 0 }
  entries.set(id, entry)
  evict()
  queue.push(async () => {
    try {
      const faces = await window.fontAPI.gfPreviewFaces(family.family, variant)
      entry.faces = faces.map((f) => {
        const ff = new FontFace(alias, `url(${f.url})`, {
          weight: f.weight,
          style: f.style,
          ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
        })
        document.fonts.add(ff)
        return ff
      })
      const css = `${variantStyle(variant)} ${variantWeight(variant)} 16px "${alias}"`
      await document.fonts.load(css, sample || family.family)
      entry.snapshot = { family: alias, state: entry.faces.length ? 'ready' : 'unavailable' }
    } catch {
      entry.snapshot = { family: alias, state: 'unavailable' }
    }
    notify()
  })
  pump()
}

/** Forgets previews that failed (e.g. while offline) so they're retried. */
export function resetUnavailable(): void {
  for (const [id, entry] of entries) if (entry.snapshot.state === 'unavailable') entries.delete(id)
  notify()
}
