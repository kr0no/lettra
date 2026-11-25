// Google's CSS2 API: turns a family + styles into @font-face blocks.
// Previews ask with a Chrome UA (woff2 split by unicode-range);
// static installs ask with a bare UA (one full TTF per style).
import type { GoogleFamily, PreviewFace } from '@shared/types'
import { CHROME_UA, fetchText, TTF_UA } from '../net/fetch'

export interface FontFaceBlock extends PreviewFace {
  format: string
}

const BLOCK = /@font-face\s*\{([^}]*)\}/g
const prop = (body: string, name: string): string | undefined =>
  new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim()

export function parseCss(css: string): FontFaceBlock[] {
  const out: FontFaceBlock[] = []
  for (const [, body = ''] of css.matchAll(BLOCK)) {
    const src = prop(body, 'src') ?? ''
    const url = /url\(([^)]+)\)/.exec(src)?.[1]?.replace(/['"]/g, '')
    if (!url) continue
    const block: FontFaceBlock = {
      url,
      format: /format\(['"]?([^'")]+)/.exec(src)?.[1] ?? '',
      weight: prop(body, 'font-weight') ?? '400',
      style: prop(body, 'font-style') === 'italic' ? 'italic' : 'normal',
    }
    const range = prop(body, 'unicode-range')
    if (range) block.unicodeRange = range
    out.push(block)
  }
  return out
}

const weightOf = (variant: string): number => Number.parseInt(variant, 10) || 400
const isItalic = (variant: string): boolean => variant.endsWith('i')

/** `family=Inter:ital,wght@0,400;1,700` for the given variants (sorted as the API requires). */
export function familyQuery(family: string, variants: string[]): string {
  const name = encodeURIComponent(family).replace(/%20/g, '+')
  const tuples = [...new Set(variants)]
    .map((v) => [isItalic(v) ? 1 : 0, weightOf(v)] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([i, w]) => `${i},${w}`)
  return `family=${name}:ital,wght@${tuples.join(';')}`
}

const cssUrl = (query: string): string => `https://fonts.googleapis.com/css2?${query}&display=swap`

/** woff2 subsets for one variant, for in-memory previews. Cached per family+variant. */
const previewCache = new Map<string, PreviewFace[]>()
export async function previewFaces(family: GoogleFamily, variant: string): Promise<PreviewFace[]> {
  const v = family.variants.includes(variant) ? variant : (family.variants[0] ?? '400')
  const key = `${family.family}|${v}`
  const hit = previewCache.get(key)
  if (hit) return hit
  const css = await fetchText(cssUrl(familyQuery(family.family, [v])), { userAgent: CHROME_UA })
  const faces = parseCss(css).map(({ format: _format, ...face }) => face)
  if (previewCache.size > 800) previewCache.delete(previewCache.keys().next().value!)
  previewCache.set(key, faces)
  return faces
}

/** One full TrueType file per variant, for static installs. */
export async function staticFiles(family: GoogleFamily): Promise<FontFaceBlock[]> {
  const css = await fetchText(cssUrl(familyQuery(family.family, family.variants)), { userAgent: TTF_UA })
  const blocks = parseCss(css).filter((b) => b.format === 'truetype' || b.url.endsWith('.ttf'))
  if (!blocks.length) throw new Error(`Google returned no TrueType files for ${family.family}`)
  return blocks
}

/**
 * Fallback for static installs when the CSS2 trick stops working: the official
 * Webfonts API (needs the user's own API key from Settings). Variants come back as
 * 'regular', 'italic', '700', '700italic' with direct TTF URLs.
 */
export async function staticFilesFromApi(family: GoogleFamily, apiKey: string): Promise<FontFaceBlock[]> {
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(apiKey)}&family=${encodeURIComponent(family.family)}`
  const data = JSON.parse(await fetchText(url, { retries: 0 })) as {
    items?: { files?: Record<string, string> }[]
  }
  const files = data.items?.[0]?.files ?? {}
  const blocks = Object.entries(files).map(([variant, href]) => {
    const italic = variant.endsWith('italic')
    const weight = variant === 'regular' || variant === 'italic' ? '400' : variant.replace('italic', '')
    return {
      url: href.replace(/^http:/, 'https:'),
      format: 'truetype',
      weight,
      style: italic ? ('italic' as const) : ('normal' as const),
    }
  })
  if (!blocks.length) throw new Error(`The Google Fonts API returned no files for ${family.family}`)
  return blocks
}
