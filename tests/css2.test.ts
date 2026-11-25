import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/net/fetch', () => ({ CHROME_UA: '', TTF_UA: '', fetchText: vi.fn() }))
const { familyQuery, parseCss } = await import('../src/main/google/css2')

const css = `
/* cyrillic */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/v1/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 700;
  src: url("https://fonts.gstatic.com/s/inter/v1/latin.ttf") format("truetype");
}
@font-face { font-family: 'Broken'; font-weight: 400; }
`

describe('parseCss', () => {
  const blocks = parseCss(css)

  it('reads every block that has a URL', () => {
    expect(blocks).toHaveLength(2)
  })

  it('reads url, format, weight, style and unicode-range', () => {
    expect(blocks[0]).toEqual({
      url: 'https://fonts.gstatic.com/s/inter/v1/cyr.woff2',
      format: 'woff2',
      weight: '400',
      style: 'normal',
      unicodeRange: 'U+0301, U+0400-045F',
    })
    expect(blocks[1]).toMatchObject({ format: 'truetype', weight: '700', style: 'italic' })
    expect(blocks[1]!.unicodeRange).toBeUndefined()
  })
})

describe('familyQuery', () => {
  it('encodes the name and sorts tuples the way the API requires', () => {
    expect(familyQuery('Noto Sans JP', ['700i', '400', '700', '400'])).toBe(
      'family=Noto+Sans+JP:ital,wght@0,400;0,700;1,700',
    )
  })

  it('escapes characters that would break the query', () => {
    expect(familyQuery('A&B', ['400'])).toBe('family=A%26B:ital,wght@0,400')
  })
})
