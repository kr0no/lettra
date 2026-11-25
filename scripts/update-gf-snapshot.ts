// Refreshes the Google Fonts catalog bundled with Lettra (used when offline on first launch).
// Run: pnpm snapshot   (Node runs this TypeScript file directly)
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { METADATA_URL, parseMetadata } from '../src/main/google/metadata-source.ts'

const res = await fetch(METADATA_URL)
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const families = parseMetadata(await res.text())
const out = join(import.meta.dirname, '..', 'resources', 'gf-snapshot.json.gz')
const body = gzipSync(JSON.stringify({ fetchedAt: new Date().toISOString(), families }), { level: 9 })
writeFileSync(out, body)
console.log(`Wrote ${families.length} families to ${out} (${(body.length / 1024).toFixed(0)} KB)`)
