// Variable font files and licenses from the google/fonts repository.
import type { GoogleFamilyInfo, GoogleLicense } from '@shared/types'
import { fetchTextOrNull } from '../net/fetch'

const RAW = 'https://raw.githubusercontent.com/google/fonts/main'
const LICENSE_DIRS: GoogleLicense[] = ['ofl', 'apache', 'ufl']

/** Repo folder name: 'Noto Sans JP' -> 'notosansjp'. */
export const slug = (family: string): string => family.toLowerCase().replace(/[^a-z0-9]/g, '')

interface RepoFamily extends GoogleFamilyInfo {
  dir: string | null
}

const cache = new Map<string, Promise<RepoFamily>>()

async function lookup(family: string): Promise<RepoFamily> {
  for (const license of LICENSE_DIRS) {
    const dir = `${license}/${slug(family)}`
    const pb = await fetchTextOrNull(`${RAW}/${dir}/METADATA.pb`)
    if (pb === null) continue
    // METADATA.pb is protobuf text format; the filenames are all we need.
    const files = [...pb.matchAll(/filename:\s*"([^"]+)"/g)].map((m) => m[1]!)
    return { license, dir, variableFiles: files.filter((f) => f.includes('[')) }
  }
  return { license: null, dir: null, variableFiles: [] }
}

export function repoFamily(family: string): Promise<RepoFamily> {
  let hit = cache.get(family)
  if (!hit) {
    hit = lookup(family)
    cache.set(family, hit)
    hit.catch(() => cache.delete(family)) // don't cache network failures
  }
  return hit
}

export const repoFileUrl = (dir: string, file: string): string => `${RAW}/${dir}/${encodeURIComponent(file)}`
