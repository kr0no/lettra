import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { create } from 'fontkit'
import type { InstallFilesResult } from '@shared/types'
import type { Platform } from '../platform'
import { FONT_FILE } from './parser'

const MAX_DEPTH = 3
const MAX_FILES = 500

/** Expands dropped paths: font files as-is, folders searched a few levels deep. */
async function collect(path: string, depth: number, out: string[], others: string[]): Promise<void> {
  if (out.length >= MAX_FILES) return
  const s = await stat(path).catch(() => null)
  if (!s) return void others.push(path)
  if (s.isDirectory()) {
    if (depth >= MAX_DEPTH) return
    const names = await readdir(path).catch(() => null)
    if (!names) return void others.push(path) // no permission to read it
    for (const name of names) {
      if (!name.startsWith('.')) await collect(join(path, name), depth + 1, out, others)
    }
  } else if (s.isFile()) {
    if (FONT_FILE.test(path)) out.push(path)
    else if (depth === 0) others.push(path) // only report files the user dropped directly
  }
}

/** A free name in `dir`: "Name.otf", then "Name 2.otf"... */
async function freeName(dir: string, file: string): Promise<string> {
  const ext = extname(file)
  const stem = basename(file, ext)
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? file : `${stem} ${n}${ext}`
    if (!(await stat(join(dir, candidate)).catch(() => null))) return candidate
  }
}

/** Font files already in the user folder (and two levels of subfolders), grouped by size. */
async function existingBySize(dir: string): Promise<Map<number, string[]>> {
  const bySize = new Map<number, string[]>()
  const walk = async (folder: string, depth: number): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
      const path = join(folder, entry.name)
      // stat follows symlinks, which Dirent doesn't.
      const s =
        entry.isSymbolicLink() || entry.isFile() || entry.isDirectory()
          ? await stat(path).catch(() => null)
          : null
      if (s?.isDirectory() && depth < 2) await walk(path, depth + 1)
      else if (s?.isFile() && FONT_FILE.test(entry.name))
        bySize.set(s.size, [...(bySize.get(s.size) ?? []), path])
    }
  }
  await walk(dir, 0)
  return bySize
}

async function alreadyThere(bySize: Map<number, string[]>, bytes: Buffer): Promise<boolean> {
  for (const path of bySize.get(bytes.length) ?? []) {
    if ((await readFile(path).catch(() => null))?.equals(bytes)) return true
  }
  return false
}

// Two drops at once would both see a free name and both report success; run them one at a time.
let queue: Promise<unknown> = Promise.resolve()

/**
 * Copies dropped font files into the user font folder. Each file is parsed first
 * (anything that isn't a font is skipped); byte-identical copies already installed are skipped.
 */
export function installFiles(platform: Platform, paths: string[]): Promise<InstallFilesResult> {
  const run = queue.then(() => install(platform, paths))
  queue = run.catch(() => undefined)
  return run
}

async function install(platform: Platform, paths: string[]): Promise<InstallFilesResult> {
  const dir = platform.userFontsDir()
  await mkdir(dir, { recursive: true })
  const files: string[] = []
  const others: string[] = []
  for (const p of paths) await collect(p, 0, files, others)

  const result: InstallFilesResult = {
    installed: [],
    skipped: others.map((p) => ({ name: basename(p), reason: 'not-a-font' as const })),
  }
  const bySize = await existingBySize(dir)
  for (const file of files) {
    const name = basename(file)
    let bytes: Buffer
    try {
      bytes = await readFile(file)
      create(bytes) // throws if it isn't a font fontkit can read
    } catch {
      result.skipped.push({ name, reason: 'unreadable' })
      continue
    }
    // Same bytes anywhere in the folder, under any name (or earlier in this same drop).
    if (await alreadyThere(bySize, bytes)) {
      result.skipped.push({ name, reason: 'already-installed' })
      continue
    }
    // Write the bytes that were checked (the source could change meanwhile), under a name
    // macOS ignores, then rename: a failed write never leaves half a font in the folder.
    const target = join(dir, await freeName(dir, name))
    const tmp = join(dir, `.${name}.lettra-tmp`)
    try {
      await writeFile(tmp, bytes)
      await rename(tmp, target)
    } catch {
      await rm(tmp, { force: true }).catch(() => undefined)
      result.skipped.push({ name, reason: 'unreadable' })
      continue
    }
    bySize.set(bytes.length, [...(bySize.get(bytes.length) ?? []), target])
    result.installed.push(target)
  }
  return result
}
