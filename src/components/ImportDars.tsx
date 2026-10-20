import { useState } from 'react'
import { programForDars } from '../data'
import type { Program, TakenCourse } from '../engine/types'
import { parseDars } from '../import/dars'
import { inputClass } from './styles'

interface Props {
  program: Program
  onImport: (courses: TakenCourse[]) => void
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
    // The major is always the one picked in the dropdown. The DARS program code
    // only drives a heads-up when it looks like a different major.
    onImport(result.courses)

    const parts = [`Imported ${result.courses.length} courses.`]
    const darsProgram = programForDars(result.programCode)
    if (darsProgram && darsProgram.id !== program.id) {
      parts.push(`Your DARS looks like it's for ${darsProgram.name}, but you picked ${program.name}. Change the major above if that's not right.`)
    } else if (result.programCode && !darsProgram) {
      parts.push(`Your DARS is for ${result.programCode}, which isn't supported yet, so it's audited against ${program.name}.`)
    }
    if (result.catalogYear && !result.catalogYear.endsWith(program.catalogYear.slice(0, 4))) {
      parts.push(`Your catalog year is ${result.catalogYear}, but these requirements are for ${program.catalogYear}.`)
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

  const tone = { ok: 'bg-black/20 text-white', warn: 'bg-black/30 text-white', error: 'bg-black/40 text-white' }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon to-[#b4462f] p-5 shadow-lg shadow-maroon/20">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-burnt/30 blur-2xl" />
      <div className="relative">
        <div className="text-sm text-white/70">Import</div>
        <h2 className="mt-1 text-xl font-semibold leading-snug text-white">Load your DARS audit</h2>
        <p className="mt-2 text-sm text-white/80">
          Run your audit in Hokie SPA and save the Audit Results page as a PDF. It's read right here in your browser
          and never uploaded.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-maroon hover:bg-white/90">
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
            className="rounded-lg border border-white/30 px-3.5 py-1.5 text-sm text-white hover:bg-white/10"
            onClick={() => setPasting((p) => !p)}
          >
            Paste text
          </button>
        </div>
        {pasting && (
          <div className="mt-3 space-y-2">
            <textarea
              className={`${inputClass} h-28 font-mono text-xs`}
              placeholder="Select all on your DARS page, copy, and paste here"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <button
              className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-maroon disabled:opacity-50"
              disabled={!pasted.trim()}
              onClick={() => importText(pasted)}
            >
              Import
            </button>
          </div>
        )}
        {message && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${tone[message.tone]}`}>{message.text}</p>}
      </div>
    </section>
  )
}
