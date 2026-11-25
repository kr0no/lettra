import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { LocalFace, UninstallPlan, UninstallTarget } from '@shared/types'
import type { Platform } from '../platform'
import type { FontLibrary } from './font-library'

function targetFaces(library: FontLibrary, target: UninstallTarget): LocalFace[] {
  if ('familyKey' in target) return library.family(target.familyKey)?.faces ?? []
  return target.faceIds.map((id) => library.face(id)).filter((f): f is LocalFace => Boolean(f))
}

/** What uninstalling `target` would remove. Only files under the user font folder are ever touched. */
export function planUninstall(
  library: FontLibrary,
  platform: Platform,
  target: UninstallTarget,
): UninstallPlan {
  const userDir = resolve(platform.userFontsDir()) + sep
  const faces = targetFaces(library, target)
  const removable = faces.filter((f) => f.removable && resolve(f.filePath).startsWith(userDir))
  const files = [...new Set(removable.map((f) => f.filePath))]
  const chosen = new Set(faces.map((f) => f.id))

  // A collection file holds several faces; removing it removes all of them.
  const allInFiles = library
    .list()
    .flatMap((fam) => fam.faces)
    .filter((f) => files.includes(f.filePath))

  return {
    files,
    faces: allInFiles.map((f) => ({ id: f.id, name: `${f.familyName} ${f.styleName}` })),
    collectionWarning: allInFiles.some((f) => !chosen.has(f.id)),
    readOnlyFaces: faces.length - removable.length,
  }
}

/** Moves the planned files to the Trash, then any folders left empty under the user font folder. */
export async function uninstall(
  library: FontLibrary,
  platform: Platform,
  target: UninstallTarget,
): Promise<string[]> {
  const plan = planUninstall(library, platform, target)
  const userDir = resolve(platform.userFontsDir())
  for (const file of plan.files) {
    if (existsSync(file)) await platform.moveToTrash(file)
  }
  for (const dir of new Set(plan.files.map((f) => dirname(f)))) {
    if (resolve(dir) === userDir || !resolve(dir).startsWith(userDir + sep)) continue
    const left = await readdir(dir).catch(() => null)
    if (left && left.every((name) => name.startsWith('.'))) await platform.moveToTrash(dir)
  }
  return plan.files
}
