import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { log } from '../log'

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Reads JSON, returning `fallback` when the file is missing, corrupt, or (with `valid`) not
 * the shape the caller expects, e.g. `null` or an array where an object should be.
 */
export async function readJson<T>(
  path: string,
  fallback: T,
  valid: (value: unknown) => boolean = () => true,
): Promise<T> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return fallback
  }
  try {
    const value: unknown = JSON.parse(text)
    if (valid(value)) return value as T
    log.warn(`${path} has an unexpected shape, starting from defaults`)
  } catch (error) {
    log.warn(`${path} is corrupt, starting from defaults`, error)
  }
  return fallback
}

/** Writes JSON atomically (temp file + rename) so a crash never leaves a half-written file. */
export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tmp, JSON.stringify(data), 'utf8')
    await rename(tmp, path)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
}

/** Serializes writes to one file and coalesces bursts into the latest value. */
export function createWriter(path: string): (data: unknown) => Promise<void> {
  let pending: unknown
  let hasPending = false
  let running: Promise<void> | null = null
  const run = async (): Promise<void> => {
    try {
      while (hasPending) {
        const data = pending
        hasPending = false
        try {
          await writeJson(path, data)
        } catch (error) {
          // Newer data is waiting: it replaces this anyway, so try that instead of giving up.
          if (!hasPending) throw error
        }
      }
    } finally {
      // A failed write must not block the next ones.
      running = null
    }
  }
  return (data) => {
    pending = data
    hasPending = true
    running ??= run()
    return running
  }
}
