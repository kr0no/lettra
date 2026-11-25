import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { LocalFace } from '@shared/types'
import { useLocalFontFace } from '@/hooks/useFontFace'
import { groupByBlock } from '@/lib/unicode-blocks'
import { Section } from './Section'

const COLUMNS = 8
const CELL = 46
const HEADER = 30

type Row = { kind: 'header'; name: string | null; count: number } | { kind: 'cells'; codePoints: number[] }

const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

// Virtualized: CJK fonts have 10k+ glyphs.
export function GlyphGrid({ face, variation }: { face: LocalFace; variation?: string }) {
  const { t, i18n } = useTranslation()
  const { data: codePoints } = useQuery({
    queryKey: ['coverage', face.id],
    queryFn: () => window.fontAPI.fontsCoverage(face.id),
  })
  const { family, state } = useLocalFontFace(face)

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const group of groupByBlock(codePoints ?? [])) {
      out.push({ kind: 'header', name: group.name, count: group.codePoints.length })
      for (let i = 0; i < group.codePoints.length; i += COLUMNS) {
        out.push({ kind: 'cells', codePoints: group.codePoints.slice(i, i + COLUMNS) })
      }
    }
    return out
  }, [codePoints])

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === 'header' ? HEADER : CELL),
    overscan: 6,
  })

  const total = codePoints?.length ?? 0
  return (
    <Section
      title={t('detail.glyphs')}
      aside={
        codePoints && (
          <span className="text-[11px] text-muted">
            {t('detail.glyphCount', { count: total, formatted: total.toLocaleString(i18n.language) })}
          </span>
        )
      }
    >
      {!codePoints ? (
        <p className="m-0 text-xs text-muted">{t('detail.loadingGlyphs')}</p>
      ) : (
        <div
          ref={scrollRef}
          className="h-[360px] overflow-y-auto rounded-md border border-line"
          style={{
            fontFamily: family ? `"${family}"` : undefined,
            fontVariationSettings: variation,
            visibility: state === 'unavailable' ? 'hidden' : 'visible',
          }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]!
              return (
                <div
                  key={item.key}
                  className="absolute inset-x-0"
                  style={{ top: 0, height: item.size, transform: `translateY(${item.start}px)` }}
                >
                  {row.kind === 'header' ? (
                    <div
                      className="flex h-full items-end justify-between px-2 pb-1 font-sans text-[11px] text-muted"
                      style={{ fontVariationSettings: 'normal' }}
                    >
                      <span className="truncate">
                        {row.name
                          ? t(`blocks.names.${row.name}`, { defaultValue: row.name })
                          : t('blocks.other')}
                      </span>
                      <span className="tabular-nums">{row.count}</span>
                    </div>
                  ) : (
                    <div className="grid h-full grid-cols-8">
                      {row.codePoints.map((cp) => (
                        <span
                          key={cp}
                          title={`${hex(cp)}  ${String.fromCodePoint(cp)}`}
                          className="grid place-items-center border-t border-r border-line text-[22px] select-text last:border-r-0 hover:bg-hover"
                        >
                          {String.fromCodePoint(cp)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Section>
  )
}
