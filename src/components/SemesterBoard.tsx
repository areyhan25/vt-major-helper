import { useState, type FormEvent, type ReactNode } from 'react'
import { isInProgress } from '../engine/grades'
import { normalizeCode } from '../engine/match'
import { PRIOR, semesterKeyFor } from '../engine/semesters'
import { termLabel, termOrder, termsAfter } from '../engine/terms'
import type { TakenCourse } from '../engine/types'
import { inputClass } from './styles'
import { Panel, Popover } from './ui'

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'AP', 'TR', 'IP', 'W']

interface Props {
  courses: TakenCourse[]
  onChange: (courses: TakenCourse[]) => void
  whatIf: boolean
  /** Empty semesters added in What-if mode. */
  extraTerms: string[]
  onExtraTerms: (terms: string[]) => void
}

export function SemesterBoard({ courses, onChange, whatIf, extraTerms, onExtraTerms }: Props) {
  const keyOf = semesterKeyFor(courses)
  // Block keys: real terms in calendar order, with prior AP/transfer credit first.
  const blocks = [...new Set([...courses.map(keyOf), ...(whatIf ? extraTerms : [])])].sort(
    (a, b) => (a === PRIOR ? -1 : b === PRIOR ? 1 : termOrder(a) - termOrder(b)),
  )
  const terms = blocks.filter((b) => b !== PRIOR)
  const last = [...courses.map((c) => c.term), ...terms].sort((a, b) => termOrder(a) - termOrder(b)).at(-1) ?? ''
  const upcoming = termsAfter(last, 6)
  const [dragging, setDragging] = useState<number>()
  const [over, setOver] = useState<string>()

  const update = (i: number, patch: Partial<TakenCourse>) =>
    onChange(courses.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const remove = (i: number) => onChange(courses.filter((_, j) => j !== i))

  function drop(term: string) {
    if (dragging !== undefined && courses[dragging]?.term !== term) update(dragging, { term })
    setDragging(undefined)
    setOver(undefined)
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Semesters</h2>
          <p className="text-sm text-muted">
            {whatIf
              ? 'Drag courses between semesters, or click one to change its grade or semester.'
              : 'Your courses, grouped by semester.'}
          </p>
        </div>
        {courses.length > 0 && !whatIf && (
          <button className="text-xs text-faint hover:text-needed" onClick={() => onChange([])}>
            Clear all courses
          </button>
        )}
      </div>

      <AddCourse
        terms={[...terms, ...upcoming]}
        defaultTerm={whatIf ? upcoming[0] : terms.at(-1) ?? upcoming[0]}
        whatIf={whatIf}
        onAdd={(c) => onChange([...courses, c])}
      />

      {blocks.length === 0 ? (
        <p className="mt-6 text-sm text-faint">No courses yet. Import your DARS or add courses above.</p>
      ) : (
        <div className="mt-5 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {blocks.map((term) => {
            const prior = term === PRIOR
            const inTerm = courses.map((c, i) => ({ c, i })).filter(({ c }) => keyOf(c) === term)
            const credits = inTerm.reduce((n, { c }) => n + c.credits, 0)
            const planned = inTerm.some(({ c }) => c.grade === 'PL')
            return (
              <div
                key={term}
                onDragOver={(e) => {
                  if (!whatIf || prior) return
                  e.preventDefault()
                  setOver(term)
                }}
                onDragLeave={() => setOver((o) => (o === term ? undefined : o))}
                onDrop={() => !prior && drop(term)}
                className={`rounded-xl border bg-raised/60 p-3 transition-colors ${
                  over === term ? 'border-burnt bg-burnt/10' : 'border-line'
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-medium">
                    {prior ? 'Transfer & AP credit' : termLabel(term)}
                    {planned && <span className="ml-2 text-xs font-normal text-burnt-soft">planned</span>}
                  </h3>
                  <span className="text-xs text-faint">{credits} cr</span>
                </div>
                {prior && (
                  <p className="-mt-1 mb-2 text-xs text-faint">Earned before your first semester at VT</p>
                )}
                {inTerm.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-faint">
                    Drop courses here
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {inTerm.map(({ c, i }) => (
                      <li
                        key={`${c.term}|${c.code}|${i}`}
                        draggable={whatIf}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', c.code)
                          e.dataTransfer.effectAllowed = 'move'
                          setDragging(i)
                        }}
                        onDragEnd={() => {
                          setDragging(undefined)
                          setOver(undefined)
                        }}
                        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-line/60 ${
                          whatIf ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${dragging === i ? 'opacity-40' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="whitespace-nowrap font-medium">{c.code}</div>
                          {c.title && <div className="truncate text-xs text-faint">{c.title}</div>}
                        </div>
                        <span className="text-xs text-faint">{c.credits}</span>
                        <GradePill grade={c.grade} />
                        {whatIf ? (
                          <EditCourse
                            course={c}
                            terms={[...terms, ...upcoming]}
                            onSave={(patch) => update(i, patch)}
                            onRemove={() => remove(i)}
                          />
                        ) : (
                          <button
                            className="px-1 text-faint opacity-0 hover:text-needed group-hover:opacity-100 focus:opacity-100"
                            aria-label={`Remove ${c.code}`}
                            onClick={() => remove(i)}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {whatIf && <AddSemester key={upcoming[0]} upcoming={upcoming} onAdd={(t) => onExtraTerms([...extraTerms, t])} />}
        </div>
      )}
    </Panel>
  )
}

function GradePill({ grade }: { grade: string }) {
  const style =
    grade === 'PL'
      ? 'border border-dashed border-burnt/60 text-burnt-soft'
      : isInProgress(grade)
        ? 'bg-progress/15 text-burnt-soft'
        : ['AP', 'TR', 'P'].includes(grade)
          ? 'bg-line text-muted'
          : ['F', 'W'].includes(grade)
            ? 'bg-needed/15 text-needed'
            : 'bg-done/10 text-done'
  return (
    <span className={`w-9 shrink-0 rounded-md py-0.5 text-center text-xs font-medium ${style}`}>
      {grade === 'PL' ? 'Plan' : grade}
    </span>
  )
}

function AddCourse({
  terms,
  defaultTerm,
  whatIf,
  onAdd,
}: {
  terms: string[]
  defaultTerm: string
  whatIf: boolean
  onAdd: (c: TakenCourse) => void
}) {
  const [code, setCode] = useState('')
  const [credits, setCredits] = useState('3')
  const [grade, setGrade] = useState('')
  const [term, setTerm] = useState('')
  const [error, setError] = useState('')
  const grades = whatIf ? ['PL', ...GRADES] : GRADES

  function submit(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizeCode(code)
    if (!/^[A-Z]{2,5} [0-9X]{4}[A-Z]?$/.test(normalized)) {
      setError('Enter a course like CS 1114.')
      return
    }
    setError('')
    onAdd({
      code: normalized,
      credits: Number(credits) || 0,
      grade: grade || (whatIf ? 'PL' : 'A'),
      term: term || defaultTerm,
    })
    setCode('')
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-page/60 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_auto]">
        <Field label="Name" className="col-span-2 sm:col-span-1">
          <input className={inputClass} placeholder="CS 1114" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Credits">
          <input className={inputClass} value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Grade">
          <select className={inputClass} value={grade || (whatIf ? 'PL' : 'A')} onChange={(e) => setGrade(e.target.value)}>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g === 'PL' ? 'Planned' : g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semester" className="col-span-2 sm:col-span-1">
          <select className={inputClass} value={term || defaultTerm} onChange={(e) => setTerm(e.target.value)}>
            {terms.map((t) => (
              <option key={t} value={t}>
                {termLabel(t)}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button className="w-full rounded-lg bg-maroon px-4 py-1.5 text-sm font-medium hover:bg-maroon-bright">
            Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-needed">{error}</p>}
    </form>
  )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function EditCourse({
  course,
  terms,
  onSave,
  onRemove,
}: {
  course: TakenCourse
  terms: string[]
  onSave: (patch: Partial<TakenCourse>) => void
  onRemove: () => void
}) {
  return (
    <Popover
      label={`Edit ${course.code}`}
      triggerClassName="rounded px-1 text-faint hover:text-ink"
      trigger={<span aria-hidden>⋯</span>}
    >
      {(close) => (
        <div className="space-y-3">
          <div className="font-semibold">{course.code}</div>
          <Field label="Grade">
            <select className={inputClass} value={course.grade} onChange={(e) => onSave({ grade: e.target.value })}>
              {['PL', ...GRADES].map((g) => (
                <option key={g} value={g}>
                  {g === 'PL' ? 'Planned' : g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Credits">
            <input
              className={inputClass}
              inputMode="decimal"
              defaultValue={course.credits}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (e.target.value !== '' && !Number.isNaN(n)) onSave({ credits: n })
              }}
            />
          </Field>
          <Field label="Semester">
            <select className={inputClass} value={course.term} onChange={(e) => onSave({ term: e.target.value })}>
              {[...new Set([course.term, ...terms])].map((t) => (
                <option key={t} value={t}>
                  {termLabel(t)}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="text-xs text-needed hover:underline"
            onClick={() => {
              onRemove()
              close()
            }}
          >
            Remove from plan
          </button>
        </div>
      )}
    </Popover>
  )
}

function AddSemester({ upcoming, onAdd }: { upcoming: string[]; onAdd: (term: string) => void }) {
  const [term, setTerm] = useState(upcoming[0])
  return (
    <div className="flex flex-col justify-center gap-2 rounded-xl border border-dashed border-line p-3">
      <span className="text-sm font-medium text-muted">Add a semester</span>
      <div className="flex gap-2">
        <select className={inputClass} value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Semester to add">
          {upcoming.map((t) => (
            <option key={t} value={t}>
              {termLabel(t)}
            </option>
          ))}
        </select>
        <button
          className="shrink-0 rounded-lg border border-line px-3 text-sm hover:border-burnt hover:text-burnt-soft"
          onClick={() => onAdd(term)}
        >
          Add
        </button>
      </div>
    </div>
  )
}
