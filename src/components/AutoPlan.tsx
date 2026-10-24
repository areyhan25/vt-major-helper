import { useState } from 'react'
import { loadSubject } from '../data/catalog'
import { autoPlan, coursesToPlan, MAX_TERMS, type AutoPlanResult, type PlanCatalogEntry } from '../engine/autoplan'
import { termLabel, termOrder } from '../engine/terms'
import type { CourseInfo, Program, TakenCourse } from '../engine/types'
import { inputClass } from './styles'
import { Panel } from './ui'

interface Props {
  program: Program
  courses: TakenCourse[]
  planned: TakenCourse[]
  info: CourseInfo
  maxCredits: number
  onMaxCredits: (n: number) => void
  onPlanned: (planned: TakenCourse[]) => void
}

const LIMITS = [12, 13, 14, 15, 16, 17, 18, 19]

async function loadCatalog(codes: string[]): Promise<Record<string, PlanCatalogEntry>> {
  const pairs = await Promise.all(
    codes.map((code) => loadSubject(code.split(' ')[0]).then((f) => [code, f?.courses[code]] as const)),
  )
  return Object.fromEntries(pairs.filter(([, c]) => c)) as Record<string, PlanCatalogEntry>
}

/** Planner mode's "fill my remaining semesters" button, and what it did. */
export function AutoPlan({ program, courses, planned, info, maxCredits, onMaxCredits, onPlanned }: Props) {
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<{ result: AutoPlanResult; before: TakenCourse[] }>()
  const hasAuto = planned.some((c) => c.autoPlan)

  async function run() {
    setBusy(true)
    try {
      // Courses you planned yourself stay. Anything auto-plan placed before is planned again.
      const manual = planned.filter((c) => !c.autoPlan)
      const catalog = await loadCatalog(coursesToPlan(program, courses, manual, info))
      const result = autoPlan({ program, courses, planned: manual, info, catalog, maxCredits })
      setLast({ result, before: planned })
      onPlanned([...manual, ...result.planned])
    } finally {
      setBusy(false)
    }
  }

  const result = last?.result
  const slots = result?.planned.filter((c) => c.autoPlan?.slot).length ?? 0
  const lastTerm = result?.planned.map((c) => c.term).sort((a, b) => termOrder(a) - termOrder(b)).at(-1)

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Auto-plan</h2>
          <p className="text-sm text-muted">
            Fills your remaining Fall and Spring semesters with what you still need, in prerequisite order. Courses
            you added yourself stay put.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted">
            Up to
            <select
              className={`${inputClass} w-auto`}
              value={maxCredits}
              onChange={(e) => onMaxCredits(Number(e.target.value))}
              aria-label="Most credits per semester"
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            credits a semester
          </label>
          <button
            className="rounded-lg bg-maroon px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon-bright disabled:opacity-60"
            onClick={run}
            disabled={busy}
          >
            {busy ? 'Planning…' : hasAuto ? 'Plan again' : 'Fill my remaining semesters'}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 space-y-2 rounded-xl bg-page/60 p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span>
              Planned <b>{result.planned.length - slots}</b> courses and <b>{slots}</b> electives for you to pick
              {lastTerm && <> through {termLabel(lastTerm)}</>}. It's a draft, so drag things around or remove them.
            </span>
            <button
              className="text-xs text-muted hover:text-ink"
              onClick={() => {
                onPlanned(last.before)
                setLast(undefined)
              }}
            >
              Undo
            </button>
          </div>
          {result.picks.length > 0 && (
            <p className="text-xs text-muted">
              Where you have a choice, it took the usual option:{' '}
              {result.picks.map((p) => `${p.picked.join(' + ')} for ${p.label}`).join('; ')}. Swap any of them with ⋯.
            </p>
          )}
          {result.unscheduled.length > 0 && (
            <p className="text-xs text-needed">
              Didn't fit in {MAX_TERMS} semesters: {result.unscheduled.join(', ')}. Try a higher credit limit.
            </p>
          )}
          <p className="text-xs text-faint">
            No Fall/Spring-only data yet, and prerequisites like "Junior standing" are estimated, so check the
            timetable and your advisor.
          </p>
        </div>
      )}
    </Panel>
  )
}
