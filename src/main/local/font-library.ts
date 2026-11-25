import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { create, type FontkitCollection, type FontkitFont } from 'fontkit'
import type { LocalFace, LocalFamily, ScanStatus } from '@shared/types'
import type { FontRoot } from '../platform'
import { ScanCache } from './cache'
import { readFace } from './collection-extract'
import { buildFaces, groupFamilies } from './grouping'
import { scanRoots } from './scanner'

interface LibraryEvents {
  changed: []
  status: [ScanStatus]
}

/** In-memory index of every local font, kept in sync with disk. */
export class FontLibrary extends EventEmitter<LibraryEvents> {
  private cache = new ScanCache()
  private families: LocalFamily[] = []
  private faces = new Map<string, LocalFace>()
  private coverage = new Map<string, number[]>()
  private running: Promise<void> | null = null
  private again = false
  /** Fingerprint of the last scan (paths + mtimes + sizes); skips work when nothing changed. */
  private signature = ''
  private status: ScanStatus = { state: 'idle', parsed: 0, toParse: 0, totalFaces: 0, lastScanMs: null }
  private ownedByLettra: (path: string) => boolean = () => false

  constructor(private readonly roots: FontRoot[]) {
    super()
  }

  private initialized: Promise<void> | null = null

  /** Loads the cache and runs the first scan. Resolves once families are available. */
  init(): Promise<void> {
    this.initialized ??= (async () => {
      await this.cache.load()
      await this.refresh()
    })().catch((error: unknown) => {
      this.initialized = null // let the next call try again
      throw error
    })
    return this.initialized
  }

  /**
   * Resolves after the first scan. Callers that read the list wait on this so an
   * early request never sees an empty library (and then misses the 'changed' event).
   */
  ready(): Promise<void> {
    return this.init()
  }

  /**
   * Rescans all roots. Unchanged files come from the cache, so this is cheap.
   * Calls made while a scan is running are coalesced into one follow-up scan.
   */
  refresh(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        try {
          await this.scanOnce()
        } catch (error) {
          // A change arrived while this scan was failing: the next one may well work.
          if (!this.again) throw error
        }
      } while (this.again)
    })().finally(() => {
      this.running = null
    })
    return this.running
  }

  list(): LocalFamily[] {
    return this.families
  }

  family(key: string): LocalFamily | undefined {
    return this.families.find((f) => f.key === key)
  }

  /** Tells the library which files Lettra installed; forces the next scan to rebuild. */
  setOwnership(owned: (path: string) => boolean): void {
    this.ownedByLettra = owned
    this.signature = ''
  }

  getStatus(): ScanStatus {
    return this.status
  }

  face(id: string): LocalFace | undefined {
    return this.faces.get(id)
  }

  /** Unicode code points the face supports, sorted ascending. Cached per face. */
  async codePoints(id: string): Promise<number[]> {
    const cached = this.coverage.get(id)
    if (cached) return cached
    const face = this.faces.get(id)
    if (!face) throw new Error(`Unknown face ${id}`)
    // Async read of just this face; fontkit only parses the cmap for characterSet.
    const f = create(await readFace(face.filePath, face.collectionIndex))
    // .dfont collections come back whole (they have no ttcf header to cut faces out of).
    const font: FontkitFont | undefined =
      'fonts' in f ? (f as FontkitCollection).fonts[face.collectionIndex ?? 0] : f
    const points = font ? [...new Set(font.characterSet)].sort((a, b) => a - b) : []
    if (this.coverage.size >= 64) this.coverage.delete(this.coverage.keys().next().value!)
    this.coverage.set(id, points)
    return points
  }

  private setStatus(patch: Partial<ScanStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('status', this.status)
  }

  private async scanOnce(): Promise<void> {
    const started = performance.now()
    this.setStatus({ state: 'scanning', parsed: 0, toParse: 0 })
    try {
      const files = await scanRoots(this.roots, this.cache, (p) => this.setStatus(p))
      const signature = createHash('sha1')
        .update(
          files
            .map((f) => `${f.path}\0${f.mtimeMs}\0${f.size}`)
            .sort()
            .join('\n'),
        )
        .digest('hex')
      if (signature === this.signature) return
      this.signature = signature
      const faces = buildFaces(files, this.ownedByLettra)
      this.faces = new Map(faces.map((f) => [f.id, f]))
      this.families = groupFamilies(faces)
      this.coverage.clear()
      this.emit('changed')
    } finally {
      this.setStatus({
        state: 'idle',
        totalFaces: this.faces.size,
        lastScanMs: Math.round(performance.now() - started),
      })
    }
  }
}
