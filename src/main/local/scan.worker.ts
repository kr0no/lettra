// Worker thread: parses font files off the main thread and streams results back in batches.
import { parentPort, workerData } from 'node:worker_threads'
import { parseFontFile, type ParsedFile } from './parser'

export interface ScanJob {
  path: string
  mtimeMs: number
  size: number
}

export type WorkerMessage = { type: 'file'; file: ParsedFile } | { type: 'done' }

// One message per file, so if a font crashes or hangs the parser, the scanner knows which one.
for (const job of (workerData as { jobs: ScanJob[] }).jobs) {
  parentPort?.postMessage({
    type: 'file',
    file: parseFontFile(job.path, job.mtimeMs, job.size),
  } satisfies WorkerMessage)
}
parentPort?.postMessage({ type: 'done' } satisfies WorkerMessage)
