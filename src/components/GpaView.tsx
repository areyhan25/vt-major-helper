import { useState } from 'react'
import { gradePoints, isInProgress, PLANNED } from '../engine/grades'
import {
  computeGpa,
  expectedKey,
  formatGpa,
  LETTER_GRADES,
  requiredAverage,
  termGpas,
  type ExpectedGrades,
  type GpaTotals,
} from '../engine/gpa'
import { termLabel, termOrder } from '../engine/terms'
import type { TakenCourse } from '../engine/types'
import { inputClass } from './styles'
import { Panel } from './ui'

interface Props {
  courses: TakenCourse[]
  expected: ExpectedGrades
  onExpected: (expected: ExpectedGrades) => void
  /** Credits left in the degree after current courses, from the audit. */
  creditsToGo: number
  /** Planner mode, where planned courses count too. */
  planning: boolean
}

const selectClass =
  'rounded-lg border border-line bg-page px-2 py-1 text-sm text-ink focus:border-burnt focus:outline-none'

export function GpaView({ courses, expected, onExpected, creditsToGo, planning }: Props) {
  const current = computeGpa(courses)
  const projected = computeGpa(courses, expected)
  const pending = courses.filter((c) => isInProgress(c.grade)).sort((a, b) => termOrder(a.term) - termOrder(b.term))
  const counted = pending.filter((c) => expected[expectedKey(c)]).length
  const rows = termGpas(courses, expected)

  const setExpected = (c: TakenCourse, grade: string) => {
    const next = { ...expected }
    if (grade) next[expectedKey(c)] = grade
    else delete next[expectedKey(c)]
    onExpected(next)
  }

  const tiles = [
    { label: 'Cumulative GPA', value: formatGpa(current.gpa), sub: 'finished courses' },
    { label: 'GPA hours', value: current.hours, sub: 'letter-graded credits' },
    { label: 'Quality points', value: round(current.qualityPoints), sub: 'credits × grade points' },
    {
      label: 'Projected GPA',
      value: formatGpa(projected.gpa),
      sub: counted ? `with ${counted} expected grade${counted > 1 ? 's' : ''}` : 'pick expected grades below',
    },
  ]

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GPA calculator</h1>
        <p className="mt-1 text-sm text-muted">
          Worked out from your courses. Pick expected grades for {planning ? 'in-progress and planned' : 'in-progress'}{' '}
          courses to see where your GPA is headed.
        </p>
      </div>

      <Panel className="grid grid-cols-2 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={`p-5 ${i % 2 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <div className="text-sm text-muted">{t.label}</div>
            <div className={`mt-1 text-3xl font-semibold tracking-tight ${i === 3 && counted ? 'text-burnt-soft' : ''}`}>
              {t.value}
            </div>
            <div className="mt-1 text-xs text-faint">{t.sub}</div>
          </div>
        ))}
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Expected grades</h2>
                <p className="text-sm text-muted">Courses without a grade yet. Leave one blank to keep it out.</p>
              </div>
              {pending.length > 1 && (
                <label className="flex items-center gap-2 text-xs text-faint">
                  Set all
                  <select
                    className={selectClass}
                    value=""
                    onChange={(e) =>
                      onExpected({
                        ...expected,
                        ...Object.fromEntries(pending.map((c) => [expectedKey(c), e.target.value])),
                      })
                    }
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {LETTER_GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="mt-4 text-sm text-faint">
                {courses.length === 0
                  ? 'No courses yet. Import your DARS or add courses on the Degree audit tab.'
                  : planning
                    ? 'No in-progress or planned courses. Plan some on the Degree audit tab.'
                    : 'No in-progress courses. Switch to Planner to plan future semesters.'}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {pending.map((c) => (
                  <li key={expectedKey(c)} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{c.code}</div>
                      <div className="truncate text-xs text-faint">
                        {termLabel(c.term)} · {c.grade === PLANNED ? 'planned' : 'in progress'}
                        {c.title && ` · ${c.title}`}
                      </div>
                    </div>
                    <span className="text-xs text-faint">{c.credits} cr</span>
                    <select
                      className={selectClass}
                      aria-label={`Expected grade for ${c.code}`}
                      value={expected[expectedKey(c)] ?? ''}
                      onChange={(e) => setExpected(c, e.target.value)}
                    >
                      <option value="">—</option>
                      {LETTER_GRADES.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-5">
            <h2 className="text-lg font-semibold">By semester</h2>
            {rows.length === 0 ? (
              <p className="mt-4 text-sm text-faint">No letter-graded courses yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-faint">
                    <tr>
                      <th className="py-2 font-medium">Semester</th>
                      <th className="py-2 text-right font-medium">Hours</th>
                      <th className="py-2 text-right font-medium">GPA</th>
                      <th className="py-2 text-right font-medium">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.term}>
                        <td className="whitespace-nowrap py-2">
                          {termLabel(r.term)}
                          {r.projected && <span className="ml-2 text-xs text-burnt-soft">projected</span>}
                        </td>
                        <td className="py-2 text-right text-muted">{r.semester.hours}</td>
                        <td className="py-2 text-right font-medium tabular-nums">{formatGpa(r.semester.gpa)}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{formatGpa(r.cumulative.gpa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <TargetGpa base={projected} creditsToGo={creditsToGo} />
          <Panel className="p-5 text-sm">
            <div className="text-muted">How it's counted</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-faint">
              <li>Each course adds credits × grade points: A = 4.0, A- = 3.7, B+ = 3.3, and so on down to F = 0.</li>
              <li>Pass/fail, AP, transfer and withdrawn courses don't count toward GPA.</li>
              <li>An F counts as GPA hours with no points. Every attempt of a retaken course counts.</li>
              <li>Your official GPA is the one on your DARS and Hokie SPA.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}

/** "What do I need to average to reach X?" over the rest of the degree, or a number of credits the student picks. */
function TargetGpa({ base, creditsToGo }: { base: GpaTotals; creditsToGo: number }) {
  const [target, setTarget] = useState('3.5')
  const [hours, setHours] = useState<string>()
  const more = Number(hours ?? creditsToGo)
  const goal = Number(target)
  const valid = target !== '' && goal >= 0 && goal <= 4 && more > 0
  const needed = valid ? requiredAverage(base, goal, more) : undefined
  const best = (base.qualityPoints + 4 * more) / (base.hours + more)

  let result
  if (needed === undefined) result = <p className="text-faint">Enter a target from 0 to 4 and some credits.</p>
  else if (needed > 4)
    result = (
      <p>
        <b className="font-semibold text-needed">Out of reach</b> in {more} credits. Straight A's would get you to{' '}
        {formatGpa(best)}.
      </p>
    )
  else if (needed <= 0) result = <p className="text-done">You'll stay at or above {target} whatever grades you get.</p>
  else
    result = (
      <p>
        You need to average <b className="text-xl font-semibold text-burnt-soft">{formatGpa(needed)}</b>, about{' '}
        {letterFor(needed)} average, over your next {more} credits.
      </p>
    )

  return (
    <Panel className="p-5">
      <div className="text-sm text-muted">Target GPA</div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-faint">
        <label className="space-y-1">
          <span>Target</span>
          <input
            className={inputClass}
            type="number"
            inputMode="decimal"
            min={0}
            max={4}
            step={0.1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span>Over the next</span>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            min={1}
            value={hours ?? creditsToGo}
            onChange={(e) => setHours(e.target.value)}
            aria-describedby="target-hours-note"
          />
        </label>
      </div>
      <p id="target-hours-note" className="mt-1 text-xs text-faint">
        Credits. Starts at what's left in your degree.
      </p>
      <div className="mt-4 text-sm">{result}</div>
      <p className="mt-3 text-xs text-faint">Starts from your projected GPA ({formatGpa(base.gpa)}).</p>
    </Panel>
  )
}

/** The nearest letter grade to `points`, e.g. 3.4 -> "a B+". */
function letterFor(points: number): string {
  const letter = LETTER_GRADES.reduce((a, b) =>
    Math.abs(gradePoints(b)! - points) < Math.abs(gradePoints(a)! - points) ? b : a,
  )
  return `${/^[AF]/.test(letter) ? 'an' : 'a'} ${letter}`
}

const round = (n: number) => Math.round(n * 100) / 100
