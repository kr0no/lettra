// Fixed geometry for the virtualized views. Rows must have a known height up front
// so scrolling 1,000+ families never measures the DOM.

export const GRID_PADDING = 20
export const GRID_GAP = 14

export function cardMinWidth(size: number): number {
  return 220 + size * 2
}

/** Line box for preview text, in whole pixels so the clamp never shows a sliver of a third line. */
export function previewLineHeight(size: number): number {
  return Math.ceil(size * 1.25)
}

/** Two clamped lines of preview text. */
export function cardPreviewHeight(size: number): number {
  return previewLineHeight(size) * 2
}

export function cardHeight(size: number): number {
  // border 1 + padding 16 + header 36 + gap 14 + preview + gap 14 + footer 22 + padding 16 + border 1
  return 120 + cardPreviewHeight(size)
}

export function gridColumns(width: number, size: number): number {
  const inner = width - GRID_PADDING * 2
  return Math.max(1, Math.floor((inner + GRID_GAP) / (cardMinWidth(size) + GRID_GAP)))
}

export function listRowHeight(size: number): number {
  return Math.max(64, Math.ceil(size * 1.25) + 28)
}
