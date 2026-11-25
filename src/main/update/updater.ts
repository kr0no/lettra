import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, writeFileSync } from 'node:fs'
import { access, constants, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { AppUpdate, UpdateProgress } from '@shared/types'
import { log, logDir } from '../log'
import { fetchStream, fetchTextOrNull, OfflineError } from '../net/fetch'
import { isNewer } from './version'

const run = promisify(execFile)

// LETTRA_UPDATE_FEED swaps in another releases/latest JSON, for testing the whole flow locally.
const FEED = process.env.LETTRA_UPDATE_FEED ?? 'https://api.github.com/repos/kr0no/lettra/releases/latest'

interface Asset {
  name: string
  browser_download_url: string
  size: number
  /** "sha256:<hex>", computed by GitHub when the file is uploaded. */
  digest?: string | null
}

interface Release {
  tag_name: string
  html_url: string
  assets: Asset[]
}

// .../Lettra.app/Contents/MacOS/Lettra -> .../Lettra.app
const bundlePath = (): string => resolve(process.execPath, '../../..')
const stagedPath = (): string => join(dirname(bundlePath()), '.Lettra-update.app')

async function blocker(zip: Asset | undefined): Promise<AppUpdate['blocker']> {
  if (!app.isPackaged) return 'dev'
  if (!zip?.digest?.startsWith('sha256:')) return 'no-zip'
  const target = bundlePath()
  // Opened straight from the DMG, or translocated by Gatekeeper: there's nothing we can replace.
  if (target.startsWith('/Volumes/') || target.includes('/AppTranslocation/')) return 'location'
  try {
    await access(dirname(target), constants.W_OK)
    await access(target, constants.W_OK)
  } catch {
    return 'location'
  }
  return undefined
}

async function plist(bundle: string, key: string): Promise<string> {
  const { stdout } = await run('plutil', [
    '-extract',
    key,
    'raw',
    '-o',
    '-',
    join(bundle, 'Contents/Info.plist'),
  ])
  return stdout.trim()
}

/** The download has to be Lettra, at the version the release says, with an intact signature. */
async function checkBundle(fresh: string, version: string): Promise<void> {
  const [id, ownId, got] = await Promise.all([
    plist(fresh, 'CFBundleIdentifier'),
    plist(bundlePath(), 'CFBundleIdentifier'),
    plist(fresh, 'CFBundleShortVersionString'),
  ])
  if (id !== ownId) throw new Error(`downloaded app is ${id}, expected ${ownId}`)
  if (got !== version) throw new Error(`downloaded app is version ${got}, expected ${version}`)
  await run('codesign', ['--verify', '--deep', '--strict', fresh])
}

// Runs after Lettra quits: swap the bundles, put the old one back if that fails, relaunch.
const SWAP_SCRIPT = `#!/bin/sh
pid="$1"; target="$2"; staged="$3"; log="$4"
note() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" >> "$log"; }
i=0
while kill -0 "$pid" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i + 1)); done
if kill -0 "$pid" 2>/dev/null; then
  note "ERROR Lettra didn't quit, update not installed"
  rm -f "$0"
  exit 1
fi
backup="$target.previous"
rm -rf "$backup"
if mv "$target" "$backup" && mv "$staged" "$target"; then
  rm -rf "$backup"
  note "INFO update installed"
else
  [ -d "$target" ] || mv "$backup" "$target"
  rm -rf "$staged"
  note "ERROR update failed, kept the previous version"
fi
open "$target"
rm -f "$0"
`

export class Updater {
  private latest: AppUpdate | null = null
  private zip: Asset | undefined
  private ready = false
  private busy = false

  constructor(private readonly progress: (p: UpdateProgress) => void) {}

  /** Leftovers from an install that didn't finish. */
  async cleanUp(): Promise<void> {
    if (app.isPackaged) await rm(stagedPath(), { recursive: true, force: true }).catch(() => undefined)
    // Downloads cut short by quitting (folders only: the swap script removes itself).
    for (const entry of await readdir(tmpdir(), { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory() && entry.name.startsWith('lettra-update-'))
        await rm(join(tmpdir(), entry.name), { recursive: true, force: true }).catch(() => undefined)
    }
  }

  current(): AppUpdate | null {
    return this.latest
  }

  /** `manual` checks report failures to the caller; automatic ones only log them. */
  async check(manual = false): Promise<AppUpdate | null> {
    // Stick with the version that's downloading or staged until it's installed.
    if (this.busy || this.ready) return this.latest
    try {
      const text = await fetchTextOrNull(FEED, { userAgent: `Lettra/${app.getVersion()}`, retries: 1 })
      if (!text) return null // no releases yet
      const release = JSON.parse(text) as Release
      const version = release.tag_name.replace(/^v/, '')
      if (!isNewer(version, app.getVersion())) {
        this.latest = null
        return null
      }
      this.zip = release.assets.find((a) => a.name.endsWith('-universal.zip'))
      const reason = await blocker(this.zip)
      this.latest = { version, url: release.html_url, canInstall: !reason, blocker: reason }
      log.info(`update ${version} available${reason ? `, can't install in place (${reason})` : ''}`)
    } catch (error) {
      if (!(error instanceof OfflineError)) log.warn('update check failed', error)
      if (manual) throw error
    }
    return this.latest
  }

  async download(): Promise<void> {
    const update = this.latest
    const zip = this.zip
    // A reopened window asks again for an update that's already staged: just say it's ready.
    if (this.ready) return this.progress({ phase: 'ready' })
    if (!update?.canInstall || !zip?.digest || this.busy) return
    this.busy = true
    let dir: string | undefined
    try {
      dir = await mkdtemp(join(tmpdir(), 'lettra-update-'))
      const file = join(dir, 'update.zip')
      const res = await fetchStream(zip.browser_download_url, { userAgent: `Lettra/${app.getVersion()}` })
      const total = Number(res.headers.get('content-length')) || zip.size
      const hash = createHash('sha256')
      let received = 0
      let reported = 0
      const progress = this.progress
      // pipeline() so a write error (disk full) fails the download instead of hanging it.
      await pipeline(
        Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>),
        new Transform({
          transform(chunk: Buffer, _encoding, done) {
            hash.update(chunk)
            received += chunk.length
            if (Date.now() - reported > 150) {
              reported = Date.now()
              progress({ phase: 'downloading', received, total })
            }
            done(null, chunk)
          },
        }),
        createWriteStream(file),
      )

      this.progress({ phase: 'verifying' })
      if (`sha256:${hash.digest('hex')}` !== zip.digest)
        throw new Error('download is corrupt (SHA-256 mismatch)')
      await run('ditto', ['-x', '-k', file, join(dir, 'app')])
      const fresh = join(dir, 'app', 'Lettra.app')
      await checkBundle(fresh, update.version)

      // Staged next to the current app so the final swap is a rename on the same volume.
      await rm(stagedPath(), { recursive: true, force: true })
      await run('ditto', [fresh, stagedPath()])
      await run('xattr', ['-dr', 'com.apple.quarantine', stagedPath()]).catch(() => undefined)
      this.ready = true
      log.info(`update ${update.version} downloaded and verified`)
      this.progress({ phase: 'ready' })
    } catch (error) {
      log.error('update download failed', error)
      await rm(stagedPath(), { recursive: true, force: true }).catch(() => undefined)
      this.progress({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      this.busy = false
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  install(): void {
    if (!this.ready) return
    const script = join(tmpdir(), `lettra-update-${process.pid}.sh`)
    writeFileSync(script, SWAP_SCRIPT, { mode: 0o700 })
    const args = [script, String(process.pid), bundlePath(), stagedPath(), join(logDir(), 'main.log')]
    spawn('/bin/sh', args, { detached: true, stdio: 'ignore' }).unref()
    log.info(`quitting to install ${this.latest?.version}`)
    app.quit()
  }
}
