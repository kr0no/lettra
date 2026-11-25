// Parses Google's public (unofficial, key-free) catalog: https://fonts.google.com/metadata/fonts
// Pure functions so the snapshot script can reuse them outside Electron.
import { familyKey } from '../../shared/family-key.ts'
import type { GoogleCategory, GoogleFamily } from '../../shared/types.ts'

export const METADATA_URL = 'https://fonts.google.com/metadata/fonts'

interface RawFamily {
  family: string
  category: string
  fonts: Record<string, unknown>
  axes?: { tag: string; min: number; max: number; defaultValue: number }[]
  subsets?: string[]
  primaryScript?: string
  designers?: string[]
  popularity?: number
  dateAdded?: string
  lastModified?: string
}

interface RawMetadata {
  axisRegistry?: { tag: string; displayName?: string }[]
  familyMetadataList: RawFamily[]
}

const CATEGORY: Record<string, GoogleCategory> = {
  'Sans Serif': 'sans-serif',
  Serif: 'serif',
  Display: 'display',
  Handwriting: 'handwriting',
  Monospace: 'monospace',
}

/** '400' < '400i' < '500'..., upright before italic at each weight. */
export function compareVariants(a: string, b: string): number {
  const wa = Number.parseInt(a, 10)
  const wb = Number.parseInt(b, 10)
  return Number(a.endsWith('i')) - Number(b.endsWith('i')) || wa - wb
}

// Malformed entries are skipped instead of failing the whole catalog over one of them.
const isUsable = (f: RawFamily): boolean =>
  !!f && typeof f.family === 'string' && !!f.family && typeof f.fonts === 'object' && f.fonts !== null

export function parseMetadata(text: string): GoogleFamily[] {
  // The endpoint used to start with an XSSI guard; strip it if it's ever back.
  const json = JSON.parse(text.replace(/^\)\]\}'\s*/, '')) as RawMetadata
  const axisNames = new Map((json.axisRegistry ?? []).map((a) => [a.tag, a.displayName ?? a.tag]))
  return json.familyMetadataList.filter(isUsable).map((f) => ({
    key: familyKey(f.family),
    family: f.family,
    category: CATEGORY[f.category] ?? 'display',
    variants: Object.keys(f.fonts).sort(compareVariants),
    axes: (f.axes ?? []).map((a) => ({
      tag: a.tag,
      name: axisNames.get(a.tag) ?? a.tag,
      min: a.min,
      max: a.max,
      default: a.defaultValue,
    })),
    subsets: (f.subsets ?? []).filter((s) => s !== 'menu'),
    primaryScript: f.primaryScript ?? '',
    designers: f.designers ?? [],
    popularity: f.popularity ?? Number.MAX_SAFE_INTEGER,
    dateAdded: f.dateAdded ?? '',
    lastModified: f.lastModified ?? '',
  }))
}
