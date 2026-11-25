import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { app } from 'electron'
import { create, type FontkitFont } from 'fontkit'
import type {
  ConflictChoice,
  GoogleFamily,
  GoogleUpdate,
  InstallMode,
  InstallPlan,
  InstallProgress,
  InstallRecord,
} from '@shared/types'
import type { FontLibrary } from '../local/font-library'
import { uninstall as uninstallLocal } from '../local/uninstall'
import { log } from '../log'
import { fetchBytes } from '../net/fetch'
import type { Platform } from '../platform'
import type { GoogleCatalog } from './catalog'
import { staticFiles, staticFilesFromApi } from './css2'
import { repoFamily, repoFileUrl } from './github'
import type { InstallManifest } from './manifest'

interface Download {
  url: string
  /** Final file name; static files are named after their PostScript name once parsed. */
  name?: string
}

const safeName = (s: string): string => s.replace(/[/\\:*?"<>|\0]/g, '').trim() || 'font'

/**
 * Installs Google families into ~/Library/Fonts/<Family>/, where macOS picks them up.
 * Files are downloaded into a temp folder, each one parsed to prove it's a valid font,
 * then the folder is moved into place in one rename. A failure leaves nothing behind.
 */
export class GoogleInstaller {
  private inFlight = new Map<string, Promise<InstallRecord | null>>()

  constructor(
    private readonly catalog: GoogleCatalog,
    private readonly manifest: InstallManifest,
    private readonly library: FontLibrary,
    private readonly platform: Platform,
    private readonly progress: (p: InstallProgress) => void,
    /** Optional Google Fonts API key from Settings, used only as a fallback. */
    private readonly apiKey: () => string | undefined = () => undefined,
  ) {}

  private async family(name: string): Promise<GoogleFamily> {
    await this.catalog.get()
    const family = this.catalog.family(name)
    if (!family) throw new Error(`${name} is not in the Google Fonts catalog`)
    return family
  }

  /** Local faces with this family name that Lettra didn't install. */
  private foreignFaces(key: string) {
    return (this.library.family(key)?.faces ?? []).filter(
      (f) => !f.installedByLettra && !this.manifest.owns(f.filePath),
    )
  }

  private async resolveMode(family: GoogleFamily, mode: InstallMode): Promise<InstallMode> {
    if (mode === 'static' || !family.axes.length) return 'static'
    return (await repoFamily(family.family)).variableFiles.length ? 'variable' : 'static'
  }

  async plan(name: string, requested: InstallMode): Promise<InstallPlan> {
    const family = await this.family(name)
    const mode = await this.resolveMode(family, requested)
    const foreign = this.foreignFaces(family.key)
    return {
      family: family.family,
      mode,
      fileCount:
        mode === 'variable' ? (await repoFamily(family.family)).variableFiles.length : family.variants.length,
      conflict: foreign.length
        ? {
            name: this.library.family(family.key)?.name ?? family.family,
            sources: [...new Set(foreign.map((f) => f.source))],
            removableFaces: foreign.filter((f) => f.removable).length,
          }
        : null,
      replacesOwn: Boolean(this.manifest.get(family.key)),
    }
  }

  install(name: string, mode: InstallMode, choice: ConflictChoice): Promise<InstallRecord | null> {
    if (choice === 'cancel') return Promise.resolve(null)
    const id = name.toLowerCase() // the catalog lookup is case-insensitive too
    const running = this.inFlight.get(id)
    if (running) return running
    const job = this.run(name, mode, choice).finally(() => this.inFlight.delete(id))
    this.inFlight.set(id, job)
    return job
  }

  /** Leftovers from installs that were cut short (crash, force quit). Run before the first scan. */
  async cleanUp(): Promise<void> {
    await rm(join(app.getPath('userData'), 'tmp'), { recursive: true, force: true }).catch(() => undefined)
    const fonts = this.platform.userFontsDir()
    const entries = await readdir(fonts).catch(() => [] as string[])
    // Half-finished copies (Google installs from another volume, dropped files).
    for (const entry of entries.filter((e) => e.endsWith('.lettra-new') || e.endsWith('.lettra-tmp'))) {
      await rm(join(fonts, entry), { recursive: true, force: true }).catch(() => undefined)
    }
    for (const entry of entries.filter((e) => e.endsWith('.lettra-old'))) {
      const aside = join(fonts, entry)
      const original = aside.slice(0, -'.lettra-old'.length)
      try {
        // Stopped mid-swap: the old version is the only copy, so put it back.
        if (!existsSync(original)) await rename(aside, original)
        else await rm(aside, { recursive: true, force: true })
        log.info(`cleaned up ${entry}`)
      } catch (error) {
        log.warn(`couldn't clean up ${entry}`, error)
      }
    }
  }

  private async run(name: string, requested: InstallMode, choice: ConflictChoice): Promise<InstallRecord> {
    const family = await this.family(name)
    const report = (phase: InstallProgress['phase'], done = 0, total = 0, error?: string): void =>
      this.progress({ key: family.key, phase, done, total, ...(error ? { error } : {}) })
    const tmp = join(app.getPath('userData'), 'tmp', randomUUID())

    try {
      report('resolving')
      const mode = await this.resolveMode(family, requested)
      const downloads = await this.resolveDownloads(family, mode)

      report('downloading', 0, downloads.length)
      await mkdir(tmp, { recursive: true })
      let done = 0
      const buffers = await Promise.all(
        downloads.map(async (d) => {
          const bytes = await fetchBytes(d.url)
          report('downloading', ++done, downloads.length)
          return { ...d, bytes }
        }),
      )

      report('verifying', 0, buffers.length)
      const used = new Set<string>()
      const files: string[] = []
      for (const b of buffers) {
        const font = this.verify(b.bytes, family.family)
        let file = safeName(b.name ?? `${font.postscriptName ?? `${family.family}-${files.length}`}.ttf`)
        while (used.has(file.toLowerCase())) file = file.replace(/(\.\w+)$/, '-1$1')
        used.add(file.toLowerCase())
        await writeFile(join(tmp, file), b.bytes)
        files.push(file)
      }

      report('committing')
      // Decided now, before the new files land, so they can never count as "foreign".
      const foreign = choice === 'replace' ? this.foreignFaces(family.key).map((f) => f.id) : []
      // Move the old install aside rather than trashing it, so a failed swap can put it back.
      const own = this.manifest.get(family.key)
      const aside = own && existsSync(own.dir) ? `${own.dir}.lettra-old` : null
      if (own && aside) {
        await rm(aside, { recursive: true, force: true })
        await rename(own.dir, aside)
      }

      const dir = this.targetDir(family.family)
      await mkdir(this.platform.userFontsDir(), { recursive: true })
      try {
        try {
          await rename(tmp, dir)
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
          // Another volume: copy next to the target first, so a failed copy never sits at `dir`.
          const copy = `${dir}.lettra-new`
          await rm(copy, { recursive: true, force: true })
          await cp(tmp, copy, { recursive: true }).catch(async (error: unknown) => {
            await rm(copy, { recursive: true, force: true }).catch(() => undefined)
            throw error
          })
          await rename(copy, dir)
        }
      } catch (error) {
        if (own && aside) await rename(aside, own.dir).catch(() => undefined)
        throw error
      }
      const record: InstallRecord = {
        key: family.key,
        family: family.family,
        mode,
        dir,
        files: files.map((f) => join(dir, f)),
        installedAt: new Date().toISOString(),
        lastModified: family.lastModified,
      }
      await this.manifest.put(record)

      // The install is done; cleaning up after it shouldn't turn it into a failure.
      if (aside) {
        await this.platform.moveToTrash(aside).catch(async (error: unknown) => {
          log.warn(`couldn't trash ${aside}, deleting it`, error)
          await rm(aside, { recursive: true, force: true }).catch(() => undefined)
        })
      }
      let warning: string | undefined
      if (foreign.length) {
        await uninstallLocal(this.library, this.platform, { faceIds: foreign }).catch((error: unknown) => {
          log.warn(`couldn't remove the fonts ${family.family} replaces`, error)
          warning = error instanceof Error ? error.message : String(error)
        })
      }
      await this.refresh()
      // Installed, but asked to replace and the old copy is still there: say so.
      report('done', files.length, files.length, warning)
      return record
    } catch (e) {
      report('error', 0, 0, e instanceof Error ? e.message : String(e))
      throw e
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  }

  private async resolveDownloads(family: GoogleFamily, mode: InstallMode): Promise<Download[]> {
    if (mode === 'variable') {
      const repo = await repoFamily(family.family)
      if (repo.dir && repo.variableFiles.length) {
        return repo.variableFiles.map((file) => ({ url: repoFileUrl(repo.dir!, file), name: file }))
      }
    }
    try {
      return (await staticFiles(family)).map((b) => ({ url: b.url }))
    } catch (e) {
      const key = this.apiKey()
      if (!key) throw e
      return (await staticFilesFromApi(family, key)).map((b) => ({ url: b.url }))
    }
  }

  /** Parses the bytes; anything that isn't a single valid font aborts the install. */
  private verify(bytes: Buffer, familyName: string): FontkitFont {
    let font
    try {
      font = create(bytes)
    } catch (e) {
      throw new Error(
        `Downloaded file for ${familyName} is not a valid font (${e instanceof Error ? e.message : e})`,
        { cause: e },
      )
    }
    if ('fonts' in font) throw new Error(`Downloaded file for ${familyName} is a font collection`)
    if (!font.numGlyphs) throw new Error(`Downloaded file for ${familyName} has no glyphs`)
    return font
  }

  /** ~/Library/Fonts/<Family>, or "<Family> (Google Fonts)" if a folder Lettra doesn't own is already there. */
  private targetDir(family: string): string {
    const base = join(this.platform.userFontsDir(), safeName(family))
    if (!existsSync(base)) return base
    let n = 1
    let dir = join(this.platform.userFontsDir(), `${safeName(family)} (Google Fonts)`)
    while (existsSync(dir))
      dir = join(this.platform.userFontsDir(), `${safeName(family)} (Google Fonts ${++n})`)
    return dir
  }

  async uninstall(name: string): Promise<void> {
    await this.inFlight.get(name.toLowerCase())?.catch(() => undefined)
    const family = await this.family(name)
    const record = this.manifest.get(family.key)
    if (!record) throw new Error(`${name} wasn't installed by Lettra`)
    // The manifest is a file on disk: never trash something outside the user font folder.
    const fonts = resolve(this.platform.userFontsDir()) + sep
    if (!resolve(record.dir).startsWith(fonts)) throw new Error(`${record.dir} is outside the font folder`)
    if (existsSync(record.dir)) await this.platform.moveToTrash(record.dir)
    await this.manifest.remove(family.key)
    await this.refresh()
  }

  // The files are already in place; a rescan failing afterwards doesn't undo that.
  private async refresh(): Promise<void> {
    await this.library.refresh().catch((error: unknown) => log.warn('rescan after install failed', error))
  }

  async updates(): Promise<GoogleUpdate[]> {
    await this.catalog.get()
    return this.manifest.list().flatMap((r) => {
      const latest = this.catalog.family(r.family)?.lastModified
      return latest && latest > r.lastModified
        ? [{ key: r.key, family: r.family, installed: r.lastModified, latest }]
        : []
    })
  }
}
