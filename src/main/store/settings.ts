import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { DEFAULT_SETTINGS, MAX_PREVIEW_TEXT, PREVIEW_SIZE } from '@shared/defaults'
import type { Settings } from '@shared/types'
import { createWriter, isRecord, readJson } from './json-store'
import { log } from '../log'

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

/** On disk the API key is encrypted with the macOS Keychain (safeStorage); in memory it's plain. */
type StoredSettings = Partial<Settings> & { version?: number; googleApiKeyEncrypted?: string }

// File format. Bump it and migrate in load() when the shape changes.
const FORMAT = 1

function toDisk(s: Settings): StoredSettings {
  const { googleApiKey, ...rest } = s
  if (!googleApiKey) return { version: FORMAT, ...rest }
  if (!safeStorage.isEncryptionAvailable()) return { version: FORMAT, ...s } // no Keychain: plain text
  return {
    version: FORMAT,
    ...rest,
    googleApiKeyEncrypted: safeStorage.encryptString(googleApiKey).toString('base64'),
  }
}

function decryptKey(stored: StoredSettings): string | undefined {
  if (!stored.googleApiKeyEncrypted) return stored.googleApiKey
  try {
    return safeStorage.decryptString(Buffer.from(stored.googleApiKeyEncrypted, 'base64'))
  } catch (error) {
    log.warn("couldn't decrypt the API key, it has to be entered again", error)
    return undefined
  }
}

function sanitize(s: Settings): Settings {
  const size = Math.min(PREVIEW_SIZE.max, Math.max(PREVIEW_SIZE.min, Math.round(s.preview.size)))
  return {
    ...s,
    language: ['system', 'en', 'es'].includes(s.language) ? s.language : 'system',
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    installMode: s.installMode === 'variable' ? 'variable' : 'static',
    offline: s.offline === true,
    checkUpdates: s.checkUpdates !== false,
    googleApiKey:
      typeof s.googleApiKey === 'string' && s.googleApiKey.trim()
        ? s.googleApiKey.trim().slice(0, 200)
        : undefined,
    preview: {
      text:
        typeof s.preview.text === 'string'
          ? Array.from(s.preview.text).slice(0, MAX_PREVIEW_TEXT).join('')
          : DEFAULT_SETTINGS.preview.text,
      size: Number.isFinite(size) ? size : DEFAULT_SETTINGS.preview.size,
      view: s.preview.view === 'list' ? 'list' : 'grid',
    },
  }
}

export class SettingsStore extends EventEmitter<{ changed: [Settings] }> {
  private value: Settings = DEFAULT_SETTINGS
  private write = createWriter(settingsPath())

  async load(): Promise<void> {
    const {
      version = 0,
      googleApiKeyEncrypted,
      ...stored
    } = await readJson<StoredSettings>(settingsPath(), {}, isRecord)
    if (version > FORMAT) log.warn(`settings.json was written by a newer Lettra (format ${version})`)
    this.value = sanitize({
      ...DEFAULT_SETTINGS,
      ...stored,
      googleApiKey: decryptKey({ ...stored, googleApiKeyEncrypted }),
      preview: { ...DEFAULT_SETTINGS.preview, ...(isRecord(stored.preview) ? stored.preview : {}) },
    })
    // Older versions stored the key in plain text: rewrite it encrypted.
    if (stored.googleApiKey && !googleApiKeyEncrypted) await this.write(toDisk(this.value))
  }

  get(): Settings {
    return this.value
  }

  async set(patch: Partial<Settings>): Promise<Settings> {
    this.value = sanitize({
      ...this.value,
      ...patch,
      preview: { ...this.value.preview, ...patch.preview },
    })
    // The new value is in effect even if saving it fails; the window must hear about it either way.
    this.emit('changed', this.value)
    await this.write(toDisk(this.value))
    return this.value
  }
}
