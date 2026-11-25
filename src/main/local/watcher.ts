import { existsSync, watch, type FSWatcher } from 'node:fs'
import type { FontRoot } from '../platform'

// A folder that's missing (a new account has no ~/Library/Fonts) or whose watch broke is
// tried again this often.
const RETRY_MS = 5_000

/**
 * Watches font roots (FSEvents on macOS, recursive) and calls `onChange` once
 * per burst of activity. Copying a family produces dozens of events; the debounce
 * turns them into a single rescan, and `maxWaitMs` makes sure a long copy still
 * shows up while it runs.
 */
export function watchRoots(
  roots: FontRoot[],
  onChange: () => void,
  debounceMs = 400,
  maxWaitMs = 3_000,
): () => void {
  let timer: NodeJS.Timeout | undefined
  let first = 0
  const fire = (): void => {
    clearTimeout(timer)
    timer = undefined
    first = 0
    onChange()
  }
  const trigger = (): void => {
    const now = Date.now()
    if (!first) first = now
    clearTimeout(timer)
    timer = setTimeout(fire, Math.max(0, Math.min(debounceMs, first + maxWaitMs - now)))
  }

  const watchers = new Map<string, FSWatcher>()
  let stopped = false
  const start = (dir: string): void => {
    if (stopped || watchers.has(dir)) return
    try {
      if (!existsSync(dir)) throw new Error('missing')
      const w = watch(dir, { recursive: true, persistent: false }, trigger)
      w.on('error', () => {
        w.close()
        watchers.delete(dir)
        trigger() // whatever broke it (folder deleted?) is worth a rescan
      })
      watchers.set(dir, w)
    } catch {
      // Not there yet or unreadable.
    }
  }
  const dirs = roots.filter((r) => r.watch).map((r) => r.dir)
  const startAll = (): void => {
    for (const dir of dirs) {
      if (watchers.has(dir)) continue
      start(dir)
      if (watchers.has(dir)) trigger() // it just appeared: pick up what's in it
    }
  }
  for (const dir of dirs) start(dir)
  const retry = setInterval(startAll, RETRY_MS)
  retry.unref()

  return () => {
    stopped = true
    clearTimeout(timer)
    clearInterval(retry)
    for (const w of watchers.values()) w.close()
  }
}
