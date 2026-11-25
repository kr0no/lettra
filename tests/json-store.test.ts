import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const logs = mkdtempSync(join(tmpdir(), 'lettra-test-logs-'))
vi.mock('electron', () => ({ app: { isPackaged: true, getPath: () => logs, on: vi.fn() } }))
const { createWriter, isRecord, readJson, writeJson } = await import('../src/main/store/json-store')

describe('json store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lettra-test-'))

  it('returns the fallback for a missing or corrupt file, and logs the corrupt one', async () => {
    expect(await readJson(join(dir, 'missing.json'), { a: 1 })).toEqual({ a: 1 })
    writeFileSync(join(dir, 'bad.json'), '{ not json')
    expect(await readJson(join(dir, 'bad.json'), [])).toEqual([])
    expect(readFileSync(join(logs, 'main.log'), 'utf8')).toContain('bad.json is corrupt')
  })

  it('treats valid JSON of the wrong shape as corrupt', async () => {
    const path = join(dir, 'null.json')
    writeFileSync(path, 'null')
    expect(await readJson(path, { ok: true }, isRecord)).toEqual({ ok: true })
    writeFileSync(path, '[1, 2]')
    expect(await readJson(path, { ok: true }, isRecord)).toEqual({ ok: true })
  })

  it('writes and reads back, creating folders', async () => {
    const path = join(dir, 'nested', 'deep', 'data.json')
    await writeJson(path, { ok: true })
    expect(await readJson(path, null)).toEqual({ ok: true })
  })

  it('keeps writing after a failed write', async () => {
    const blocker = join(dir, 'blocked')
    writeFileSync(blocker, 'a file where a folder should be')
    const path = join(blocker, 'data.json')
    const write = createWriter(path)
    await expect(write({ n: 1 })).rejects.toThrow()
    rmSync(blocker)
    await write({ n: 2 })
    expect(await readJson(path, null)).toEqual({ n: 2 })
  })

  it('coalesces a burst of writes into the latest value', async () => {
    const path = join(dir, 'burst.json')
    const write = createWriter(path)
    await Promise.all([1, 2, 3, 4, 5].map((n) => write({ n })))
    expect(await readJson(path, null)).toEqual({ n: 5 })
  })
})
