import { useState } from 'react'
import type { Program, TakenCourse } from '../engine/types'
import vtLogo from '../assets/vt-logo-white.svg'
import { DARS_ACCEPT, readDars, readDarsFile, type DarsMessage, type DarsResult } from '../import/readDars'
import { PasteDars } from './ImportDars'

interface Props {
  program: Program
  onDars: (courses: TakenCourse[], message: DarsMessage) => void
  onManual: () => void
  /** Back to the welcome page to pick a different major. */
  onBack: () => void
}

/** The page after picking a major: two big boxes, upload a DARS report or add courses by hand. */
export function ImportStep({ program, onDars, onManual, onBack }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<DarsMessage>()
  const [dragOver, setDragOver] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  function finish(result: DarsResult) {
    if ('error' in result) setError(result.error)
    else onDars(result.courses, result.message)
  }

  async function onFile(file: File) {
    setBusy(true)
    setError(undefined)
    finish(await readDarsFile(file, program))
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-[8vh] pb-8">
      <img src={vtLogo} alt="Virginia Tech" className="h-10 w-auto select-none" draggable={false} />
      <div className="mt-6 rounded-full bg-maroon/25 px-3 py-1 text-xs font-semibold text-burnt-soft">{program.name}</div>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-4xl">Add your courses</h1>
      <p className="mt-2 text-center text-muted">Bring in your DARS report, or type your courses in yourself.</p>

      <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <section
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files[0]
            if (f) void onFile(f)
          }}
          className={`relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-maroon to-[#b4462f] shadow-lg shadow-maroon/20 transition ${
            dragOver ? 'ring-2 ring-white' : ''
          }`}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-burnt/30 blur-2xl" />
          <label className="relative flex flex-1 cursor-pointer flex-col p-6 hover:bg-white/5">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Recommended</span>
            <DocIcon />
            <span className="mt-4 text-2xl font-semibold text-white">Upload DARS report</span>
            <span className="mt-2 text-sm leading-relaxed text-white/80">
              Run your audit in Hokie SPA and save the Audit Results page as a PDF. Drop it here or click to choose it.
              It&rsquo;s read right here in your browser and never uploaded.
            </span>
            <span className="mt-5 inline-flex w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold text-maroon">
              {busy ? 'Reading…' : 'Choose PDF'}
            </span>
            <input
              type="file"
              accept={DARS_ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
          </label>
          <div className="relative px-6 pb-5">
            <button className="text-sm text-white/80 underline-offset-2 hover:text-white hover:underline" onClick={() => setPasting((p) => !p)}>
              Or paste the page&rsquo;s text
            </button>
            {pasting && <PasteDars value={pasted} onChange={setPasted} onImport={() => finish(readDars(pasted, program))} />}
            {error && <p className="mt-3 rounded-lg bg-black/40 px-3 py-2 text-sm text-white">{error.text}</p>}
          </div>
        </section>

        <button
          onClick={onManual}
          className="group flex flex-col rounded-2xl border border-line bg-panel p-6 text-left transition-colors hover:border-burnt"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">No DARS handy?</span>
          <PencilIcon />
          <span className="mt-4 text-2xl font-semibold text-ink">Add courses manually</span>
          <span className="mt-2 text-sm leading-relaxed text-muted">
            Type in the courses you&rsquo;ve taken, semester by semester. You can upload a DARS later from the top of
            the audit.
          </span>
          <span className="mt-auto pt-5">
            <span className="inline-flex rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink group-hover:border-burnt group-hover:text-burnt-soft">
              Start adding
            </span>
          </span>
        </button>
      </div>

      <button className="mt-8 text-sm text-muted hover:text-ink" onClick={onBack}>
        ← Pick a different major
      </button>

      <p className="mt-auto max-w-md pt-10 text-center text-xs leading-relaxed text-faint">
        Unofficial planning tool. Always check your official DARS and talk with your advisor. Your courses stay in this
        browser.
      </p>
    </div>
  )
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="mt-4 size-10 text-white">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5M12 18v-6m0 0-2.5 2.5M12 12l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="mt-4 size-10 text-burnt">
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z" strokeLinejoin="round" />
      <path d="m13.5 6.5 4 4" strokeLinecap="round" />
    </svg>
  )
}
