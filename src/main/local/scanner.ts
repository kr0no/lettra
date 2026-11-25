import { opendir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { FontRoot } from '../platform'
import type { ScanCache } from './cache'
import { log } from '../log'
import { FONT_FILE, formatOf, type ParsedFile } from './parser'
import createScanWorker from './scan.worker?nodeWorker'
import type { ScanJob, WorkerMessage } from './scan.worker'

export interface ScannedFile extends ParsedFile {
  root: FontRoot
}

interface Candidate extends ScanJob {
  root: FontRoot
}

async function walk(root: FontRoot, dir: string, out: Candidate[]): Promise<void> {
  let handle
  try {
    handle = await opendir(dir)
  } catch {
    return // missing or unreadable folder
  }
  try {
    for await (const entry of handle) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!root.descend || root.descend(relative(root.dir, path))) await walk(root, path, out)
      } else if ((entry.isFile() || entry.isSymbolicLink()) && FONT_FILE.test(entry.name)) {
        try {
          const s = await stat(path) // follows file symlinks
          if (s.isFile()) out.push({ root, path, mtimeMs: s.mtimeMs, size: s.size })
        } catch {
          // broken symlink or vanished file
        }
      }
    }
  } catch (error) {
    log.warn(`stopped reading ${dir}`, error) // keep what was found so far
  }
}

// No message for this long means the parser is stuck on a file.
const STALL_MS = 60_000

interface WorkerRun {
  count: number
  failure?: string
}

function runWorker(jobs: ScanJob[], onBatch: (files: ParsedFile[]) => void): Promise<WorkerRun> {
  return new Promise((resolve) => {
    const worker = createScanWorker({ workerData: { jobs } })
    let count = 0
    let buffer: ParsedFile[] = []
    let settled = false
    const flush = (): void => {
      if (buffer.length) onBatch(buffer)
      buffer = []
    }
    const finish = (failure?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      flush()
      void worker.terminate()
      resolve({ count, failure })
    }
    let timer = setTimeout(() => finish('parser timed out'), STALL_MS)
    worker.on('message', (msg: WorkerMessage) => {
      clearTimeout(timer)
      timer = setTimeout(() => finish('parser timed out'), STALL_MS)
      if (msg.type === 'done') return finish()
      count++
      buffer.push(msg.file)
      if (buffer.length >= 25) flush()
    })
    worker.on('error', (error: Error) => finish(error.message))
    worker.on('exit', (code) => finish(`scan worker exited with code ${code}`))
  })
}

/**
 * Parses files in a worker thread. A file that crashes or hangs the parser is recorded as
 * unreadable (so it isn't retried every launch) and the rest carry on in a new worker.
 */
async function parseInWorker(jobs: ScanJob[], onBatch: (files: ParsedFile[]) => void): Promise<void> {
  let next = 0
  let failedInARow = 0
  while (next < jobs.length) {
    const run = await runWorker(jobs.slice(next), onBatch)
    next += run.count
    if (!run.failure) continue
    // A worker that can't parse anything at all is broken, not the files.
    failedInARow = run.count ? 1 : failedInARow + 1
    if (failedInARow >= 3) throw new Error(run.failure)
    const bad = jobs[next]
    if (!bad) break
    log.warn(`skipping ${bad.path}: ${run.failure}`)
    onBatch([{ ...bad, format: formatOf(bad.path) ?? 'ttf', faces: [], error: run.failure }])
    next++
  }
}

export interface ScanProgress {
  parsed: number
  toParse: number
}

/**
 * Walks every root, reuses cached metadata for unchanged files, and parses the rest
 * in a worker thread. Returns every font file found, with its root attached.
 */
export async function scanRoots(
  roots: FontRoot[],
  cache: ScanCache,
  onProgress: (p: ScanProgress) => void,
): Promise<ScannedFile[]> {
  const candidates: Candidate[] = []
  await Promise.all(
    roots.map(async (root) => {
      const found: Candidate[] = []
      await walk(root, root.dir, found)
      candidates.push(...found)
    }),
  )

  const result: ScannedFile[] = []
  const misses: Candidate[] = []
  for (const c of candidates) {
    const hit = cache.hit(c.path, c.mtimeMs, c.size)
    if (hit) result.push({ ...hit, root: c.root })
    else misses.push(c)
  }

  const rootByPath = new Map(misses.map((m) => [m.path, m.root]))
  let parsed = 0
  onProgress({ parsed, toParse: misses.length })
  await parseInWorker(
    misses.map(({ path, mtimeMs, size }) => ({ path, mtimeMs, size })),
    (files) => {
      for (const f of files) {
        const root = rootByPath.get(f.path)
        if (root) result.push({ ...f, root })
      }
      parsed += files.length
      onProgress({ parsed, toParse: misses.length })
    },
  )

  // Nothing new parsed and nothing gone: the cache on disk is already right.
  if (misses.length || result.length !== cache.size) {
    // Files that couldn't be opened (permissions, I/O) are tried again next time.
    await cache.replaceAll(result.filter((f) => !f.retry).map(({ root: _root, ...file }) => file))
  }
  return result
}
