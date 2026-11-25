// Vite plugin that writes out/THIRD_PARTY_NOTICES.txt: the license of every npm package
// that ends up in the app, either bundled by Vite or shipped in node_modules (fontkit).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { Plugin } from 'vite'

interface Pkg {
  name: string
  version: string
  license: string
  text: string
}

// The config gets bundled before it runs, so import.meta paths aren't reliable here.
const root = process.cwd()
const found = new Map<string, Pkg>()

function readPkg(dir: string): void {
  if (found.has(dir) || !existsSync(join(dir, 'package.json'))) return
  const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)/i.test(f))
  found.set(dir, {
    name: json.name,
    version: json.version,
    license: typeof json.license === 'string' ? json.license : 'see package',
    text: file ? readFileSync(join(dir, file), 'utf8').trim() : fallbackText(json),
  })
  // Runtime dependencies come along too.
  for (const dep of Object.keys(json.dependencies ?? {})) readPkg(join(root, 'node_modules', dep))
}

// package.json fields that can be a string or an object.
const field = (v: unknown, key: 'name' | 'url'): string =>
  typeof v === 'string'
    ? v
    : v && typeof v === 'object'
      ? String((v as Record<string, unknown>)[key] ?? '')
      : ''

// A few packages declare a license but ship no file for it.
function fallbackText(json: { license?: string; author?: unknown; repository?: unknown }): string {
  const by = field(json.author, 'name')
  const at = field(json.repository, 'url')
  return `${json.license ?? 'Unknown'} license${by ? `, copyright ${by}` : ''}.${at ? ` Source: ${at}` : ''}`
}

function packageDir(id: string): string | null {
  const marker = `${sep}node_modules${sep}`
  const at = id.lastIndexOf(marker)
  if (at < 0) return null
  const rest = id.slice(at + marker.length).split(sep)
  const name = rest[0]?.startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1)
  return join(id.slice(0, at + marker.length), ...name)
}

function write(): void {
  const pkgs = [...found.values()].filter((p) => p.name).sort((a, b) => a.name.localeCompare(b.name))
  const seen = new Set<string>()
  const body = pkgs
    .filter((p) => !seen.has(p.name) && seen.add(p.name))
    .map((p) => `${p.name} ${p.version} (${p.license})\n\n${p.text}`)
    .join(`\n\n${'-'.repeat(72)}\n\n`)
  const header =
    'Lettra includes the following third-party software. The Electron and Chromium licenses are\n' +
    'next to this file: LICENSE.electron.txt and LICENSES.chromium.html.\n\n'
  writeFileSync(join(root, 'out', 'THIRD_PARTY_NOTICES.txt'), header + body + '\n')
}

export function thirdPartyNotices(options: { includeDependencies?: boolean } = {}): Plugin {
  return {
    name: 'third-party-notices',
    apply: 'build',
    generateBundle() {
      for (const id of this.getModuleIds()) {
        const dir = packageDir(id.replace(/^\0/, '').split('?')[0]!)
        if (dir) readPkg(dir)
      }
      if (options.includeDependencies) {
        const own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
        for (const dep of Object.keys(own.dependencies ?? {})) readPkg(join(root, 'node_modules', dep))
      }
    },
    // main, preload and renderer build one after another; each rewrites the file with all it has seen.
    closeBundle: write,
  }
}
