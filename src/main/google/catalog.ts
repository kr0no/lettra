import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { app } from 'electron'
import type { Catalog, GoogleFamily } from '@shared/types'
import snapshotPath from '../../../resources/gf-snapshot.json.gz?asset'
import { fetchText, OfflineError } from '../net/fetch'
import { createWriter, isRecord, readJson } from '../store/json-store'
import { METADATA_URL, parseMetadata } from './metadata-source'
import { log } from '../log'

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const cachePath = (): string => join(app.getPath('userData'), 'cache', 'gf-catalog.json')

interface Stored {
  fetchedAt: string
  families: GoogleFamily[]
}

/**
 * Google Fonts catalog: network -> local cache -> bundled snapshot.
 * Refreshed from the network when older than 7 days (or on demand).
 */
export class GoogleCatalog {
  private current: Catalog | null = null
  private byKey = new Map<string, GoogleFamily>()
  private loading: Promise<Catalog> | null = null
  /** After a failed refresh, keep serving what we have for a while instead of refetching on every read. */
  private retryAfter = 0
  private write = createWriter(cachePath())

  get(options: { refresh?: boolean } = {}): Promise<Catalog> {
    const fresh = this.current && (!this.isStale(this.current) || Date.now() < this.retryAfter)
    if (this.current && !options.refresh && fresh) return Promise.resolve(this.current)
    this.loading ??= this.load(Boolean(options.refresh)).finally(() => {
      this.loading = null
    })
    return this.loading
  }

  family(name: string): GoogleFamily | undefined {
    return this.byKey.get(name.toLowerCase()) ?? [...this.byKey.values()].find((f) => f.family === name)
  }

  private isStale(c: Catalog): boolean {
    return Date.now() - Date.parse(c.fetchedAt) > MAX_AGE_MS
  }

  private set(catalog: Catalog): Catalog {
    this.current = catalog
    this.byKey = new Map(catalog.families.map((f) => [f.family.toLowerCase(), f]))
    return catalog
  }

  private async load(force: boolean): Promise<Catalog> {
    const cached = this.current ?? (await this.readCache())
    if (cached && !force && !this.isStale(cached)) return this.set(cached)
    try {
      const families = parseMetadata(await fetchText(METADATA_URL, { timeoutMs: 30_000 }))
      const fetchedAt = new Date().toISOString()
      void this.write({ fetchedAt, families } satisfies Stored)
      return this.set({ families, fetchedAt, origin: 'network' })
    } catch (error) {
      // Offline or the endpoint changed: fall back to what we have.
      // Offline isn't a failure: going back online should refetch right away, and it isn't worth a log line.
      if (!(error instanceof OfflineError)) {
        log.warn('catalog refresh failed, using ' + (cached ? 'cache' : 'snapshot'), error)
        this.retryAfter = Date.now() + 60 * 60_000
      }
      if (cached) return this.set(cached)
      return this.set(await this.readSnapshot())
    }
  }

  private async readCache(): Promise<Catalog | null> {
    const stored = await readJson<Stored | null>(
      cachePath(),
      null,
      (v) => isRecord(v) && Array.isArray(v.families) && typeof v.fetchedAt === 'string',
    )
    return stored?.families?.length ? { ...stored, origin: 'cache' } : null
  }

  private async readSnapshot(): Promise<Catalog> {
    const stored = JSON.parse(gunzipSync(await readFile(snapshotPath)).toString('utf8')) as Stored
    return { ...stored, origin: 'snapshot' }
  }
}
