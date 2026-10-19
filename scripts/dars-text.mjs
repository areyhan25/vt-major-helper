// Prints the text the app would extract from a DARS PDF, for checking the importer.
// Usage: npm run dars:text -- path/to/audit.pdf
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const path = process.argv[2]
if (!path) {
  console.error('Usage: npm run dars:text -- path/to/audit.pdf')
  process.exit(1)
}
const data = new Uint8Array(await readFile(path))
const doc = await getDocument({ data }).promise
const lines = []
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n)
  const { items } = await page.getTextContent()
  // Same grouping as src/import/pdfText.ts
  const rows = []
  for (const item of items) {
    if (!item.str?.trim()) continue
    const y = item.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) <= 2)
    if (row) row.items.push(item)
    else rows.push({ y, items: [item] })
  }
  rows.sort((a, b) => b.y - a.y)
  for (const r of rows) lines.push(r.items.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str.trim()).join('   '))
}
console.log(lines.join('\n'))
