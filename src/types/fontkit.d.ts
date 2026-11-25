// fontkit 3 ships without type declarations. This covers only the parts Lettra uses.
declare module 'fontkit' {
  export interface FontkitAxis {
    name: string
    min: number
    default: number
    max: number
  }

  export interface FontkitFont {
    readonly type: string
    readonly postscriptName: string | null
    readonly fullName: string | null
    readonly familyName: string | null
    readonly subfamilyName: string | null
    readonly version: string | null
    readonly numGlyphs: number
    readonly characterSet: number[]
    readonly italicAngle: number
    readonly variationAxes: Record<string, FontkitAxis>
    readonly namedVariations: Record<string, Record<string, number>>
    readonly directory: { tables: Record<string, unknown> }
    readonly 'OS/2'?: {
      usWeightClass: number
      usWidthClass: number
      fsSelection: { italic: boolean; oblique: boolean; bold: boolean; regular: boolean }
    }
    getName(key: string, lang?: string): string | null
  }

  export interface FontkitCollection {
    readonly type: 'TTC' | 'DFont' | string
    readonly fonts: FontkitFont[]
    getFont(postscriptName: string): FontkitFont | null
  }

  export function openSync(filename: string, postscriptName?: string | null): FontkitFont | FontkitCollection
  export function open(
    filename: string,
    postscriptName?: string | null,
  ): Promise<FontkitFont | FontkitCollection>
  export function create(buffer: Uint8Array, postscriptName?: string | null): FontkitFont | FontkitCollection
}
