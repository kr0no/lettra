import type { FontSource, LocalFace, LocalFamily } from '@shared/types'
import type { LocalSection } from '@/stores/ui'

const SYSTEM_SOURCES: FontSource[] = ['system', 'local', 'apple-asset']

export function inSection(family: LocalFamily, section: LocalSection): boolean {
  if (section === 'user') return family.sources.includes('user')
  if (section === 'system') return family.sources.some((s) => SYSTEM_SOURCES.includes(s))
  return true
}

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Matches family name, style names and PostScript names, ignoring case and accents. */
export function matches(family: LocalFamily, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  if (fold(family.name).includes(q)) return true
  return family.faces.some(
    (f) => fold(f.postscriptName).includes(q) || fold(`${f.familyName} ${f.styleName}`).includes(q),
  )
}

/** Faces worth showing: hidden dot-prefixed system faces are left out. */
export function visibleFaces(family: LocalFamily): LocalFace[] {
  const faces = family.faces.filter((f) => !f.hiddenSystemFont)
  return faces.length ? faces : family.faces
}

/** Distance from an upright, normal-width Regular. */
const regularness = (f: LocalFace): number =>
  (f.italic ? 1000 : 0) + Math.abs(f.width - 5) * 100 + Math.abs(f.weight - 400)

/** The face that best represents a family: upright regular width/weight, else the closest. */
export function representative(family: LocalFamily): LocalFace | undefined {
  const faces = visibleFaces(family)

  return faces.reduce<LocalFace | undefined>(
    (best, f) => (!best || regularness(f) < regularness(best) ? f : best),
    undefined,
  )
}
