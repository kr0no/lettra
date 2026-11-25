// All of Lettra's network access goes through here: one place for offline mode,
// timeouts, retries and concurrency limits.

export class OfflineError extends Error {
  constructor() {
    super('Lettra is in offline mode')
    this.name = 'OfflineError'
  }
}

let offline = false
export function setOffline(value: boolean): void {
  offline = value
}

/** Chrome's UA: Google's CSS2 API then serves woff2 split by unicode-range (small preview downloads). */
export const CHROME_UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
/** A bare UA makes the CSS2 API return full TrueType files. */
export const TTF_UA = 'Mozilla/5.0'

interface FetchOptions {
  userAgent?: string
  timeoutMs?: number
  retries?: number
}

const MAX_CONCURRENT = 6
let active = 0
const waiting: (() => void)[] = []

async function slot<T>(run: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve))
  active++
  try {
    return await run()
  } finally {
    active--
    waiting.shift()?.()
  }
}

async function request(
  url: string,
  { userAgent, timeoutMs = 20_000, retries = 2 }: FetchOptions,
): Promise<Response> {
  if (offline) throw new OfflineError()
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await slot(() =>
        fetch(url, {
          headers: userAgent ? { 'user-agent': userAgent } : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        }),
      )
      // 4xx won't get better by retrying.
      if (res.ok || (res.status >= 400 && res.status < 500)) return res
      lastError = new Error(`HTTP ${res.status} for ${url}`)
    } catch (e) {
      lastError = e
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const res = await request(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

/** Returns null on 404 so callers can probe for optional files. */
export async function fetchTextOrNull(url: string, options: FetchOptions = {}): Promise<string | null> {
  const res = await request(url, options)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

/** For large downloads read as a stream. Same offline check and retries, no body timeout. */
export async function fetchStream(url: string, options: FetchOptions = {}): Promise<Response> {
  const res = await request(url, { timeoutMs: 30 * 60_000, ...options })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  return res
}

export async function fetchBytes(url: string, options: FetchOptions = {}): Promise<Buffer> {
  const res = await request(url, { timeoutMs: 120_000, ...options })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return Buffer.from(await res.arrayBuffer())
}
