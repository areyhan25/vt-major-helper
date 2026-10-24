import { useState } from 'react'
import type { Program, TakenCourse } from '../engine/types'
import { DARS_ACCEPT, readDars, readDarsFile, type DarsMessage, type DarsResult } from '../import/readDars'
import { inputClass } from './styles'

interface Props {
  program: Program
  /** True once there are courses, so the button says Replace instead of Upload. */
  hasCourses: boolean
  /** A note left over from importing on the setup page. */
  initialMessage?: DarsMessage
  onImport: (courses: TakenCourse[]) => void
}

/** A slim strip at the top of the audit for uploading or replacing the DARS report. */
export function ImportDars({ program, hasCourses, initialMessage, onImport }: Props) {
  const [message, setMessage] = useState<DarsMessage | undefined>(initialMessage)
  const [busy, setBusy] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  function finish(result: DarsResult) {
    if ('error' in result) {
      setMessage(result.error)
      return
    }
    onImport(result.courses)
    setMessage(result.message)
    setPasting(false)
    setPasted('')
  }

  async function onFile(file: File) {
    setBusy(true)
    setMessage(undefined)
    finish(await readDarsFile(file, program))
    setBusy(false)
  }

  return (
    <section
      aria-label="DARS report"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon to-[#b4462f] px-5 py-4 shadow-lg shadow-maroon/20"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-burnt/30 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-white">{hasCourses ? 'Your DARS report' : 'Upload your DARS report'}</h2>
          <p className="text-sm text-white/80">
            {hasCourses
              ? 'Got a newer audit? Upload it to replace your courses.'
              : 'Save your Audit Results from Hokie SPA as a PDF. It’s read right here and never uploaded.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-maroon hover:bg-white/90">
            {busy ? 'Reading…' : hasCourses ? 'Replace DARS' : 'Upload DARS'}
            <input
              type="file"
              accept={DARS_ACCEPT}
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
      </div>
      {pasting && (
        <PasteDars value={pasted} onChange={setPasted} onImport={() => finish(readDars(pasted, program))} />
      )}
      {message && (
        <p className="relative mt-3 flex items-start justify-between gap-3 rounded-lg bg-black/30 px-3 py-2 text-sm text-white">
          <span>{message.text}</span>
          <button className="text-white/70 hover:text-white" aria-label="Dismiss" onClick={() => setMessage(undefined)}>
            ×
          </button>
        </p>
      )}
    </section>
  )
}

/** The paste-the-page fallback, for when saving a PDF isn't working. */
export function PasteDars({ value, onChange, onImport }: { value: string; onChange: (v: string) => void; onImport: () => void }) {
  return (
    <div className="relative mt-3 space-y-2">
      <textarea
        className={`${inputClass} h-28 font-mono text-xs`}
        placeholder="Select all on your DARS page, copy, and paste here"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-maroon disabled:opacity-50"
        disabled={!value.trim()}
        onClick={onImport}
      >
        Import
      </button>
    </div>
  )
}
