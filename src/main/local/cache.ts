import { join } from 'node:path'
import { app } from 'electron'
import { createWriter, isRecord, readJson } from '../store/json-store'
import type { ParsedFile } from './parser'

/** Bump when ParsedFile's shape or parsing rules change, to force a full re-parse. */
const CACHE_VERSION = 2

interface CacheFile {
  version: number
  files: Record<string, ParsedFile>
}

const cachePath = (): string => join(app.getPath('userData'), 'cache', 'local-fonts.json')

export class ScanCache {
  private files = new Map<string, ParsedFile>()
  private write = createWriter(cachePath())

  async load(): Promise<void> {
    const data = await readJson<CacheFile>(
      cachePath(),
      { version: 0, files: {} },
      (v) => isRecord(v) && isRecord(v.files),
    )
    if (data.version !== CACHE_VERSION) return
    this.files = new Map(Object.entries(data.files))
  }

  get size(): number {
    return this.files.size
  }

  /** Cached entry if the file is unchanged on disk. */
  hit(path: string, mtimeMs: number, size: number): ParsedFile | undefined {
    const f = this.files.get(path)
    return f && f.mtimeMs === mtimeMs && f.size === size ? f : undefined
  }

  /** Replaces the cache with exactly the files seen in the latest scan and persists it. */
  replaceAll(files: ParsedFile[]): Promise<void> {
    this.files = new Map(files.map((f) => [f.path, f]))
    return this.write({ version: CACHE_VERSION, files: Object.fromEntries(this.files) } satisfies CacheFile)
  }
}
