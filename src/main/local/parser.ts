// Runs inside the scan worker. Pure: file path in, plain metadata out.
import { openSync, type FontkitCollection, type FontkitFont } from 'fontkit'
import type { FontFormat, NamedInstance, VariationAxis } from '@shared/types'

export interface ParsedFace {
  collectionIndex: number | null
  familyName: string
  styleName: string
  postscriptName: string
  weight: number
  italic: boolean
  width: number
  isVariable: boolean
  axes?: VariationAxis[]
  instances?: NamedInstance[]
  version?: string
  designer?: string
  /** Size of the face served on its own: header plus its tables. Collections share tables, so this can exceed a share of the file. */
  bytes?: number
}

export interface ParsedFile {
  path: string
  mtimeMs: number
  size: number
  format: FontFormat
  faces: ParsedFace[]
  /** Set when fontkit could not read the file; kept in the cache so it isn't retried every launch. */
  error?: string
  /** The file couldn't be opened at all (permissions, I/O): not cached, so a fix is picked up. */
  retry?: boolean
}

const TRANSIENT = new Set(['EACCES', 'EPERM', 'EIO', 'EBUSY', 'EMFILE', 'ENFILE', 'ENOENT'])

const FORMATS: Record<string, FontFormat> = {
  ttf: 'ttf',
  otf: 'otf',
  ttc: 'ttc',
  otc: 'otc',
  dfont: 'dfont',
  woff: 'woff',
  woff2: 'woff2',
}

export const FONT_FILE = /\.(ttf|otf|ttc|otc|dfont|woff2?)$/i

export function formatOf(path: string): FontFormat | null {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return FORMATS[ext] ?? null
}

function isCollection(f: FontkitFont | FontkitCollection): f is FontkitCollection {
  return 'fonts' in f && Array.isArray((f as FontkitCollection).fonts)
}

function clean(s: string | null | undefined): string | undefined {
  const t = s?.replace(/\0/g, '').trim()
  return t ? t : undefined
}

const pad4 = (n: number): number => n + ((4 - (n % 4)) % 4)

function faceBytes(font: FontkitFont): number | undefined {
  // fontkit doesn't type the table directory.
  const tables = (font as unknown as { directory?: { tables?: Record<string, { length: number }> } })
    .directory?.tables
  if (!tables) return undefined
  const list = Object.values(tables)
  return 12 + 16 * list.length + list.reduce((sum, t) => sum + pad4(t.length), 0)
}

function describe(font: FontkitFont, collectionIndex: number | null, fallbackName: string): ParsedFace {
  const os2 = font['OS/2']
  const isVariable = 'fvar' in font.directory.tables
  const family = clean(font.getName('preferredFamily')) ?? clean(font.familyName) ?? fallbackName
  const style = clean(font.getName('preferredSubfamily')) ?? clean(font.subfamilyName) ?? 'Regular'
  const face: ParsedFace = {
    collectionIndex,
    familyName: family,
    styleName: style,
    postscriptName: clean(font.postscriptName) ?? `${family}-${style}`.replace(/\s+/g, ''),
    weight: os2?.usWeightClass || 400,
    italic: Boolean(os2?.fsSelection.italic || os2?.fsSelection.oblique || font.italicAngle !== 0),
    width: os2?.usWidthClass || 5,
    isVariable,
  }
  const version = clean(font.version)
  if (version) face.version = version
  const designer = clean(font.getName('designer'))
  if (designer) face.designer = designer
  if (isVariable) {
    face.axes = Object.entries(font.variationAxes).map(([tag, a]) => ({
      tag,
      name: a.name,
      min: a.min,
      default: a.default,
      max: a.max,
    }))
    face.instances = Object.entries(font.namedVariations).map(([name, coordinates]) => ({
      name,
      coordinates,
    }))
  }
  return face
}

export function parseFontFile(path: string, mtimeMs: number, size: number): ParsedFile {
  const format = formatOf(path) ?? 'ttf'
  const fallbackName = path.slice(path.lastIndexOf('/') + 1).replace(FONT_FILE, '')
  try {
    const f = openSync(path)
    const fonts = isCollection(f) ? f.fonts : [f]
    const faces: ParsedFace[] = []
    fonts.forEach((font, i) => {
      try {
        const face = describe(font, isCollection(f) ? i : null, fallbackName)
        if (isCollection(f)) face.bytes = faceBytes(font)
        faces.push(face)
      } catch {
        // A single unreadable face shouldn't drop the rest of the collection.
      }
    })
    return { path, mtimeMs, size, format, faces }
  } catch (e) {
    const retry = TRANSIENT.has((e as NodeJS.ErrnoException).code ?? '') || undefined
    return {
      path,
      mtimeMs,
      size,
      format,
      faces: [],
      error: e instanceof Error ? e.message : String(e),
      retry,
    }
  }
}
