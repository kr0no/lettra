import { protocol } from 'electron'
import { FONT_PROTOCOL } from '@shared/ipc-contract'
import type { FontFormat } from '@shared/types'
import { readFace } from '../local/collection-extract'
import type { FontLibrary } from '../local/font-library'
import { log } from '../log'

const MIME: Record<FontFormat, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  ttc: 'font/collection',
  otc: 'font/collection',
  dfont: 'application/octet-stream',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

/** Must run before app 'ready'. */
export function registerFontScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FONT_PROTOCOL,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ])
}

/** Small byte-budgeted LRU for served font bodies; previews re-request the same faces often. */
class BodyCache {
  private map = new Map<string, Buffer>()
  private bytes = 0
  constructor(private readonly budget: number) {}
  get(key: string): Buffer | undefined {
    const v = this.map.get(key)
    if (v) {
      this.map.delete(key)
      this.map.set(key, v)
    }
    return v
  }
  set(key: string, value: Buffer): void {
    if (value.byteLength > this.budget / 4) return // don't let one huge CJK font evict everything
    // Two requests for the same face can both miss and both land here.
    const old = this.map.get(key)
    if (old) {
      this.bytes -= old.byteLength
      this.map.delete(key) // so it goes back to the end as the most recent
    }
    this.map.set(key, value)
    this.bytes += value.byteLength
    for (const [k, v] of this.map) {
      if (this.bytes <= this.budget) break
      this.map.delete(k)
      this.bytes -= v.byteLength
    }
  }
}

/**
 * Serves lettra-font://face/<faceId>. Only ids produced by a scan resolve, so the
 * renderer can never ask for an arbitrary file path. Collection faces are extracted
 * into standalone fonts. dfont faces return 415 and the renderer falls back to local().
 */
export function handleFontProtocol(library: FontLibrary): void {
  const cache = new BodyCache(64 * 1024 * 1024)
  protocol.handle(FONT_PROTOCOL, async (request) => {
    const url = new URL(request.url)
    const id = url.hostname === 'face' ? url.pathname.slice(1) : ''
    const face = library.face(id)
    if (!face) return new Response('Not found', { status: 404 })
    if (face.format === 'dfont') return new Response('Unsupported format', { status: 415 })

    let body = cache.get(id)
    if (!body) {
      try {
        body = await readFace(face.filePath, face.collectionIndex)
      } catch (error) {
        log.warn(`can't read ${face.filePath}`, error)
        return new Response('Unreadable', { status: 410 })
      }
      cache.set(id, body)
    }
    const type =
      face.collectionIndex === null ? MIME[face.format] : face.format === 'otc' ? 'font/otf' : 'font/ttf'
    // Response copies the bytes anyway; the view just makes sure only this face's bytes go.
    return new Response(new Uint8Array(body.buffer, body.byteOffset, body.byteLength), {
      headers: { 'content-type': type, 'cache-control': 'no-cache' },
    })
  })
}
