import { useEffect, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useElementWidth } from '@/hooks/useElementWidth'
import { cardHeight, GRID_GAP, GRID_PADDING, gridColumns } from './layout'

interface VirtualGridProps<T extends { key: string }> {
  items: T[]
  size: number
  selected: string | null
  /** Scrolls back to the top whenever this changes (e.g. the search text). */
  scrollKey?: string
  renderItem: (item: T, selected: boolean) => ReactNode
  /** Reports the column count so keyboard navigation can move up/down a row. */
  onColumns: (columns: number) => void
}

export function VirtualGrid<T extends { key: string }>({
  items,
  size,
  selected,
  scrollKey,
  renderItem,
  onColumns,
}: VirtualGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [scrollKey])
  const width = useElementWidth(scrollRef)
  const columns = gridColumns(width, size)
  const rowHeight = cardHeight(size) + GRID_GAP

  const virtualizer = useVirtualizer({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
    paddingStart: GRID_PADDING - 6,
    paddingEnd: GRID_PADDING,
  })

  useEffect(() => onColumns(columns), [columns, onColumns])
  useEffect(() => virtualizer.measure(), [rowHeight, columns, virtualizer])

  // Keep the selected card in view (keyboard navigation).
  const selectedIndex = selected ? items.findIndex((f) => f.key === selected) : -1
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(Math.floor(selectedIndex / columns), { align: 'auto' })
  }, [selectedIndex, columns, virtualizer])

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            className="absolute inset-x-0 grid"
            style={{
              top: 0,
              transform: `translateY(${row.start}px)`,
              height: rowHeight,
              gap: GRID_GAP,
              padding: `0 ${GRID_PADDING}px`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {items.slice(row.index * columns, row.index * columns + columns).map((item) => (
              <div key={item.key} className="min-w-0">
                {renderItem(item, item.key === selected)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
