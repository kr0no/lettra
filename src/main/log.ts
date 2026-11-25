import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

// ~/Library/Logs/Lettra/main.log, rotated to main.old.log at 1 MB.
// Messages are always in English, whatever the UI language: they end up in bug reports.
const MAX_SIZE = 1024 * 1024

export const logDir = (): string => app.getPath('logs')
const logFile = (): string => join(logDir(), 'main.log')

type Level = 'info' | 'warn' | 'error'

function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  return String(error)
}

function write(level: Level, message: string, error?: unknown): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${error === undefined ? '' : `\n${describe(error)}`}\n`
  if (!app.isPackaged) process.stderr.write(line)
  try {
    const file = logFile()
    mkdirSync(logDir(), { recursive: true })
    try {
      if (statSync(file).size > MAX_SIZE) renameSync(file, join(logDir(), 'main.old.log'))
    } catch {
      // no log file yet
    }
    appendFileSync(file, line)
  } catch {
    // never let logging take the app down
  }
}

export const log = {
  info: (message: string) => write('info', message),
  warn: (message: string, error?: unknown) => write('warn', message, error),
  error: (message: string, error?: unknown) => write('error', message, error),
}

export function catchCrashes(): void {
  process.on('uncaughtException', (error) => log.error('uncaught exception', error))
  process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason))
  app.on('render-process-gone', (_e, _wc, details) =>
    log.error(`renderer gone: ${details.reason} (${details.exitCode})`),
  )
  app.on('child-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit') log.error(`${details.type} process gone: ${details.reason}`)
  })
}
