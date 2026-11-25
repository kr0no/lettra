import { EventEmitter } from 'node:events'
import { join, sep } from 'node:path'
import { app } from 'electron'
import type { InstallRecord } from '@shared/types'
import { createWriter, isRecord, readJson } from '../store/json-store'

const manifestPath = (): string => join(app.getPath('userData'), 'installed-google.json')

/** Families Lettra installed from Google Fonts. The only fonts the catalog may uninstall. */
export class InstallManifest extends EventEmitter<{ changed: [InstallRecord[]] }> {
  private records = new Map<string, InstallRecord>()
  private write = createWriter(manifestPath())

  async load(): Promise<void> {
    const list = await readJson<InstallRecord[]>(manifestPath(), [], Array.isArray)
    const valid = list.filter(
      (r) => isRecord(r) && typeof r.key === 'string' && typeof r.dir === 'string' && Array.isArray(r.files),
    )
    this.records = new Map(valid.map((r) => [r.key, r]))
  }

  list(): InstallRecord[] {
    return [...this.records.values()]
  }

  get(key: string): InstallRecord | undefined {
    return this.records.get(key)
  }

  /** True if the path is inside a folder Lettra installed. */
  owns(path: string): boolean {
    for (const r of this.records.values()) if (path === r.dir || path.startsWith(r.dir + sep)) return true
    return false
  }

  async put(record: InstallRecord): Promise<void> {
    this.records.set(record.key, record)
    await this.save()
  }

  async remove(key: string): Promise<void> {
    if (this.records.delete(key)) await this.save()
  }

  /** Drops files that no longer exist (e.g. uninstalled through the local view) and empty records. */
  async prune(exists: (path: string) => boolean): Promise<void> {
    let changed = false
    for (const [key, r] of this.records) {
      // Set aside by an update in progress (or one that was cut short and gets restored at launch).
      if (exists(`${r.dir}.lettra-old`)) continue
      const files = r.files.filter(exists)
      if (files.length === r.files.length) continue
      changed = true
      if (files.length) this.records.set(key, { ...r, files })
      else this.records.delete(key)
    }
    if (changed) await this.save()
  }

  private async save(): Promise<void> {
    await this.write(this.list())
    this.emit('changed', this.list())
  }
}
