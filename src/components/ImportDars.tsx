import { useState } from 'react'
import { programForDars } from '../data'
import type { Program, TakenCourse } from '../engine/types'
import { parseDars } from '../import/dars'

interface Props {
  program: Program
  onImport: (courses: TakenCourse[], matched: Program | undefined) => void
}

export function ImportDars({ program, onImport }: Props) {
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string }>()
  const [busy, setBusy] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  function importText(text: string) {
    const result = parseDars(text)
    if (result.courses.length === 0) {
      setMessage({ tone: 'error', text: "Couldn't find any courses. Is this a DARS Audit Results report?" })
      return
    }
    const matched = programForDars(result.programCode)
    onImport(result.courses, matched)

    const parts = [`Imported ${result.courses.length} courses.`]
    if (result.programCode && !matched) {
      parts.push(`Your DARS is for ${result.programCode}, which isn't supported yet, so it's audited against ${program.name}.`)
    }
    const startYear = (matched ?? program).catalogYear.slice(0, 4)
    if (result.catalogYear && !result.catalogYear.endsWith(startYear)) {
      parts.push(`Your catalog year is ${result.catalogYear}, but these requirements are for ${(matched ?? program).catalogYear}.`)
    }
    setMessage({ tone: parts.length > 1 ? 'warn' : 'ok', text: parts.join(' ') })
    setPasting(false)
    setPasted('')
  }

  async function onFile(file: File) {
    setBusy(true)
    setMessage(undefined)
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const { pdfToText } = await import('../import/pdf')
        importText(await pdfToText(await file.arrayBuffer()))
      } else {
        importText(await file.text())
      }
    } catch (e) {
      setMessage({ tone: 'error', text: `Couldn't read that file: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  const tone = { ok: 'bg-green-50 text-green-800', warn: 'bg-amber-50 text-amber-900', error: 'bg-red-50 text-red-800' }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Import your DARS</h2>
      <p className="mt-1 text-sm text-stone-600">
        In Hokie SPA, run your degree audit, then print or save the Audit Results page as a PDF. It's read right here
        in your browser and never uploaded.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon-dark">
          {busy ? 'Reading…' : 'Choose PDF'}
          <input
            type="file"
            accept=".pdf,.txt,.html,application/pdf,text/plain"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </label>
        <button
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
          onClick={() => setPasting((p) => !p)}
        >
          Paste text instead
        </button>
      </div>
      {pasting && (
        <div className="mt-3 space-y-2">
          <textarea
            className="h-32 w-full rounded-md border border-stone-300 p-2 font-mono text-xs"
            placeholder="Select all on your DARS page, copy, and paste here"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button
            className="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!pasted.trim()}
            onClick={() => importText(pasted)}
          >
            Import
          </button>
        </div>
      )}
      {message && <p className={`mt-3 rounded-md px-3 py-2 text-sm ${tone[message.tone]}`}>{message.text}</p>}
    </section>
  )
}
