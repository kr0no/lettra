import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { app } from 'electron'
import type { Collection, Library } from '@shared/types'
import { log } from '../log'
import { createWriter, isRecord, readJson } from './json-store'

const libraryPath = (): string => join(app.getPath('userData'), 'library.json')
const MAX_NAME = 80
// File format. Bump it and migrate in load() when the shape changes.
const FORMAT = 1

const cleanName = (name: string): string => {
  // By code point, so an emoji at the limit isn't cut in half.
  const n = Array.from(String(name).replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME).join('').trim()
  if (!n) throw new Error('Collection name cannot be empty')
  return n
}
const cleanKeys = (keys: unknown): string[] =>
  Array.isArray(keys)
    ? [...new Set(keys.filter((k): k is string => typeof k === 'string' && k.length > 0))]
    : []

/** Favorites and user collections, keyed by family key so local and Google entries share them. */
export class LibraryStore extends EventEmitter<{ changed: [Library] }> {
  private value: Library = { favorites: [], collections: [] }
  private write = createWriter(libraryPath())

  async load(): Promise<void> {
    const { version = 0, ...stored } = await readJson<Partial<Library> & { version?: number }>(
      libraryPath(),
      {},
      isRecord,
    )
    if (version > FORMAT) log.warn(`library.json was written by a newer Lettra (format ${version})`)
    this.value = {
      favorites: cleanKeys(stored.favorites),
      collections: (Array.isArray(stored.collections) ? stored.collections : [])
        .filter((c) => c && typeof c.id === 'string')
        .map((c) => ({
          id: c.id,
          name: typeof c.name === 'string' && c.name.trim() ? c.name : 'Untitled',
          familyKeys: cleanKeys(c.familyKeys),
        })),
    }
  }

  get(): Library {
    return this.value
  }

  toggleFavorite(key: string): Promise<Library> {
    const has = this.value.favorites.includes(key)
    return this.commit({
      ...this.value,
      favorites: has ? this.value.favorites.filter((k) => k !== key) : [...this.value.favorites, key],
    })
  }

  create(name: string, keys: string[]): Promise<Library> {
    const collection: Collection = { id: randomUUID(), name: cleanName(name), familyKeys: cleanKeys(keys) }
    return this.commit({ ...this.value, collections: [...this.value.collections, collection] })
  }

  rename(id: string, name: string): Promise<Library> {
    return this.update(id, (c) => ({ ...c, name: cleanName(name) }))
  }

  delete(id: string): Promise<Library> {
    return this.commit({ ...this.value, collections: this.value.collections.filter((c) => c.id !== id) })
  }

  add(id: string, keys: string[]): Promise<Library> {
    return this.update(id, (c) => ({ ...c, familyKeys: [...new Set([...c.familyKeys, ...cleanKeys(keys)])] }))
  }

  remove(id: string, keys: string[]): Promise<Library> {
    const drop = new Set(cleanKeys(keys))
    return this.update(id, (c) => ({ ...c, familyKeys: c.familyKeys.filter((k) => !drop.has(k)) }))
  }

  private update(id: string, fn: (c: Collection) => Collection): Promise<Library> {
    if (!this.value.collections.some((c) => c.id === id)) throw new Error('Collection not found')
    return this.commit({
      ...this.value,
      collections: this.value.collections.map((c) => (c.id === id ? fn(c) : c)),
    })
  }

  private async commit(next: Library): Promise<Library> {
    this.value = next
    this.emit('changed', next) // in effect even if saving fails
    await this.write({ version: FORMAT, ...next })
    return next
  }
}
