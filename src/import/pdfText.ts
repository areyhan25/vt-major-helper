/** A positioned run of text, as pdf.js reports it. */
export interface TextItem {
  str: string
  /** [scaleX, skewX, skewY, scaleY, x, y] */
  transform: number[]
}

/**
 * Rebuilds lines of text from pdf.js text items by grouping items at the same
 * height and ordering them left to right. Items are joined with wide spacing so
 * column-based parsing (like DARS course lines) still works.
 */
export function itemsToLines(items: TextItem[], tolerance = 2): string[] {
  const rows: { y: number; items: TextItem[] }[] = []
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = item.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) <= tolerance)
    if (row) row.items.push(item)
    else rows.push({ y, items: [item] })
  }
  // PDF y grows upward, so the top of the page has the largest y.
  rows.sort((a, b) => b.y - a.y)
  return rows.map((r) =>
    r.items
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map((i) => i.str.trim())
      .join('   '),
  )
}
