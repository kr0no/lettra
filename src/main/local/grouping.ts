import { createHash } from 'node:crypto'
import { familyKey } from '@shared/family-key'
import type { FontSource, LocalFace, LocalFamily } from '@shared/types'
import type { ScannedFile } from './scanner'

// The file's mtime and size are part of the id so a font that gets rewritten (e.g. a Google
// update into the same folder) gets fresh ids, and every cache keyed by id reloads it.
export const faceId = (path: string, index: number | null, version = ''): string =>
  createHash('sha1')
    .update(`${path}#${index ?? 0}#${version}`)
    .digest('hex')
    .slice(0, 16)

const SOURCE_ORDER: FontSource[] = ['user', 'local', 'system', 'apple-asset']

function byStyle(a: LocalFace, b: LocalFace): number {
  return (
    Number(a.italic) - Number(b.italic) ||
    a.width - b.width ||
    a.weight - b.weight ||
    a.styleName.localeCompare(b.styleName)
  )
}

/** Flattens scanned files into faces with stable ids and duplicate links. */
export function buildFaces(
  files: ScannedFile[],
  ownedByLettra: (path: string) => boolean = () => false,
): LocalFace[] {
  const faces: LocalFace[] = []
  for (const file of files) {
    for (const f of file.faces) {
      faces.push({
        ...f,
        id: faceId(file.path, f.collectionIndex, `${file.mtimeMs}:${file.size}`),
        filePath: file.path,
        format: file.format,
        source: file.root.source,
        removable: file.root.removable,
        hiddenSystemFont: f.familyName.startsWith('.') || f.postscriptName.startsWith('.'),
        duplicateFaceIds: [],
        installedByLettra: ownedByLettra(file.path),
        // A collection face is served on its own, with its own copy of any shared tables.
        fileSize: f.bytes ?? file.size,
      })
    }
  }
  const byPs = new Map<string, LocalFace[]>()
  for (const face of faces) {
    const list = byPs.get(face.postscriptName)
    if (list) list.push(face)
    else byPs.set(face.postscriptName, [face])
  }
  for (const list of byPs.values()) {
    if (list.length < 2) continue
    for (const face of list) face.duplicateFaceIds = list.filter((o) => o !== face).map((o) => o.id)
  }
  return faces
}

/** Groups faces into families by typographic family name. */
export function groupFamilies(faces: LocalFace[]): LocalFamily[] {
  const groups = new Map<string, LocalFace[]>()
  for (const face of faces) {
    const key = familyKey(face.familyName)
    const list = groups.get(key)
    if (list) list.push(face)
    else groups.set(key, [face])
  }
  const families: LocalFamily[] = []
  for (const [key, list] of groups) {
    list.sort(byStyle)
    const names = new Map<string, number>()
    for (const f of list) names.set(f.familyName, (names.get(f.familyName) ?? 0) + 1)
    const name = [...names].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key
    const sources = SOURCE_ORDER.filter((s) => list.some((f) => f.source === s))
    families.push({
      key,
      name,
      faces: list,
      sources,
      removable: list.some((f) => f.removable),
      hasDuplicates: list.some((f) => f.duplicateFaceIds.length > 0),
      hidden: list.every((f) => f.hiddenSystemFont),
    })
  }
  return families.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
