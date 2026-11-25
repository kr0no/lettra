import { existsSync } from 'node:fs'
import { copyFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Platform } from '../src/main/platform'
import { installFiles } from '../src/main/local/install-files'

const ARIAL = '/System/Library/Fonts/Supplemental/Arial.ttf'

describe.runIf(existsSync(ARIAL))('installFiles', () => {
  it('skips a font that is already installed under another name, even when dropped twice at once', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lettra-'))
    const fonts = join(root, 'Fonts')
    const platform = { userFontsDir: () => fonts } as unknown as Platform
    const dropped = join(root, 'Renamed.ttf')
    await copyFile(ARIAL, dropped)

    const [a, b] = await Promise.all([installFiles(platform, [dropped]), installFiles(platform, [dropped])])
    expect(a.installed.length + b.installed.length).toBe(1)
    expect([...a.skipped, ...b.skipped].map((s) => s.reason)).toEqual(['already-installed'])

    const again = await installFiles(platform, [ARIAL])
    expect(again.installed).toEqual([])
    expect(await readdir(fonts)).toEqual(['Renamed.ttf'])
  })
})

describe.runIf(existsSync(ARIAL))('unreadable input', () => {
  it('installs the rest of a dropped folder when a subfolder is locked', async () => {
    const { chmod, mkdir } = await import('node:fs/promises')
    const root = await mkdtemp(join(tmpdir(), 'lettra-'))
    const platform = { userFontsDir: () => join(root, 'Fonts') } as unknown as Platform
    const drop = join(root, 'drop')
    await mkdir(join(drop, 'locked'), { recursive: true })
    await copyFile(ARIAL, join(drop, 'Arial.ttf'))
    await chmod(join(drop, 'locked'), 0o000)
    try {
      const result = await installFiles(platform, [drop])
      expect(result.installed).toHaveLength(1)
    } finally {
      await chmod(join(drop, 'locked'), 0o755)
    }
  })

  it("doesn't cache a font it wasn't allowed to open", async () => {
    const { chmod } = await import('node:fs/promises')
    const { parseFontFile } = await import('../src/main/local/parser')
    const path = join(await mkdtemp(join(tmpdir(), 'lettra-')), 'Locked.ttf')
    await copyFile(ARIAL, path)
    await chmod(path, 0o000)
    const parsed = parseFontFile(path, 0, 0)
    await chmod(path, 0o644)
    expect(parsed.retry).toBe(true)
    expect(parseFontFile(path, 0, 0).faces.length).toBeGreaterThan(0)
  })
})
