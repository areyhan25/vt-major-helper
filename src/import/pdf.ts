import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { itemsToLines, type TextItem } from './pdfText'

GlobalWorkerOptions.workerSrc = workerUrl

/** Extracts the text of a PDF in the browser. Nothing is uploaded anywhere. */
export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const doc = await getDocument({ data }).promise
  const pages: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    const items = content.items.filter((i): i is TextItem & typeof i => 'str' in i)
    pages.push(itemsToLines(items).join('\n'))
  }
  await doc.loadingTask.destroy()
  return pages.join('\n')
}
