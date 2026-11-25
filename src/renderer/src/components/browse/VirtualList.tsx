import { useEffect, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { listRowHeight } from './layout'

interface VirtualListProps<T extends { key: string }> {
  items: T[]
  size: number
  selected: string | null
  /** Scrolls back to the top whenever this changes (e.g. the search text). */
  scrollKey?: string
  renderItem: (item: T, selected: boolean) => ReactNode
}

export function VirtualList<T extends { key: string }>({
  items,
  size,
  selected,
  scrollKey,
  renderItem,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [scrollKey])
  const rowHeight = listRowHeight(size)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 6,
  })

  useEffect(() => virtualizer.measure(), [rowHeight, virtualizer])

  const selectedIndex = selected ? items.findIndex((f) => f.key === selected) : -1
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
  }, [selectedIndex, virtualizer])

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]!
          return (
            <div
              key={item.key}
              className="absolute inset-x-0"
              style={{ top: 0, height: rowHeight, transform: `translateY(${row.start}px)` }}
            >
              {renderItem(item, item.key === selected)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
