import { describe, expect, it } from 'vitest'
import {
  cardHeight,
  cardMinWidth,
  GRID_GAP,
  GRID_PADDING,
  gridColumns,
  listRowHeight,
  previewLineHeight,
} from '@/components/browse/layout'

describe('card geometry', () => {
  it('uses whole-pixel line boxes for two clamped lines', () => {
    expect(previewLineHeight(32)).toBe(40)
    expect(previewLineHeight(33)).toBe(42)
    expect(cardHeight(32)).toBe(120 + 80)
  })

  it('never returns fewer than one column', () => {
    expect(gridColumns(0, 72)).toBe(1)
    expect(gridColumns(300, 72)).toBe(1)
  })

  it('fits as many cards as the width allows', () => {
    const width = 3 * cardMinWidth(24) + 2 * GRID_GAP + 2 * GRID_PADDING
    expect(gridColumns(width, 24)).toBe(3)
    expect(gridColumns(width - 1, 24)).toBe(2)
  })

  it('keeps list rows at least 64px', () => {
    expect(listRowHeight(14)).toBe(64)
    expect(listRowHeight(72)).toBe(118)
  })
})
