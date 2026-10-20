import { courseInfo } from '../data'
import { useCatalogCourse } from '../data/catalog'
import { termLabel } from '../engine/terms'
import type { TakenCourse } from '../engine/types'
import { useState } from 'react'
import { catalogUrl, displayCode } from '../courseLinks'
import { inputClass } from './styles'
import { Popover } from './ui'

interface Props {
  code: string
  /** The student's own record of this course, if they took it. */
  taken?: TakenCourse
  /** Titles known from the student's courses, keyed by code. */
  titles: Record<string, string>
  /** In Planner mode: add this course to a planned semester. */
  onPlan?: (code: string, term: string) => void
  planTerms?: string[]
  variant?: 'option' | 'used' | 'heading'
}

/** A course code chip that opens a card with what we know about the course and a catalog link. */
export function CourseChip({ code, taken, titles, onPlan, planTerms = [], variant = 'option' }: Props) {
  const isPattern = /[*X]/.test(code.split(' ')[1] ?? '')
  const title = taken?.title ?? titles[code]

  const chipClass = {
    used: 'rounded-md bg-raised px-2 py-0.5 text-xs text-ink/90 hover:bg-line',
    option:
      'rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:border-burnt hover:text-burnt-soft',
    heading: 'font-medium underline decoration-faint decoration-dotted underline-offset-4 hover:text-burnt-soft',
  }[variant]

  return (
    <Popover
      label={`About ${displayCode(code)}`}
      triggerClassName={chipClass}
      trigger={
        <>
          {displayCode(code)}
          {taken && variant !== 'heading' && <span className="ml-1 text-faint">· {taken.grade}</span>}
        </>
      }
    >
      {(close) => (
        <CourseCard
          code={code}
          isPattern={isPattern}
          taken={taken}
          knownTitle={title}
          onPlan={onPlan && ((t) => (onPlan(code, t), close()))}
          planTerms={planTerms}
        />
      )}
    </Popover>
  )
}

/** The open card. Only mounted while open, so a subject's catalog file loads on first use. */
function CourseCard({
  code,
  isPattern,
  taken,
  knownTitle,
  onPlan,
  planTerms,
}: {
  code: string
  isPattern: boolean
  taken?: TakenCourse
  knownTitle?: string
  onPlan?: (term: string) => void
  planTerms: string[]
}) {
  const lookup = useCatalogCourse(code)
  const course = lookup.status === 'found' ? lookup.course : undefined
  const title = course?.title ?? knownTitle
  const pathways = courseInfo[code]?.pathways
  const [picked, setTerm] = useState<string>()
  const term = picked && planTerms.includes(picked) ? picked : planTerms[0]

  return (
    <div className="space-y-2">
      <div>
        <div className="text-base font-semibold">{displayCode(code)}</div>
        {title && <div className="text-muted">{title}</div>}
        {isPattern && <div className="text-muted">Any {displayCode(code)}-level course (some exclusions apply)</div>}
      </div>
      {taken && (
        <div className="text-xs text-muted">
          {termLabel(taken.term)} · {taken.credits} credits · grade {taken.grade}
        </div>
      )}
      {!isPattern && lookup.status === 'loading' && <div className="text-xs text-faint">Loading description…</div>}
      {course && (
        <>
          {!taken && course.credits && <div className="text-xs text-muted">{course.credits}</div>}
          {course.description && (
            <p className="max-h-48 overflow-y-auto pr-1 text-xs leading-relaxed text-ink/85">{course.description}</p>
          )}
          {course.prereq && <Fact label="Prerequisites" value={course.prereq} />}
          {course.coreq && <Fact label="Corequisites" value={course.coreq} />}
          {course.crossListed && <Fact label="Cross-listed" value={course.crossListed} />}
        </>
      )}
      {!isPattern && lookup.status === 'missing' && (
        <div className="text-xs text-faint">Not in the current VT catalog. It may have been renumbered or retired.</div>
      )}
      {pathways && <div className="text-xs text-muted">Pathways: {pathways.join(', ')}</div>}
      <a
        href={catalogUrl(code)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-burnt hover:text-burnt-soft"
      >
        {isPattern ? 'Browse courses in the catalog' : 'View in VT catalog'} ↗
      </a>
      {onPlan && !isPattern && planTerms.length > 0 && (
        <div className="flex gap-2 border-t border-line pt-3">
          <select className={inputClass} value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Semester">
            {planTerms.map((t) => (
              <option key={t} value={t}>
                {termLabel(t)}
              </option>
            ))}
          </select>
          <button
            className="shrink-0 rounded-lg bg-maroon px-3 py-1.5 text-sm font-medium hover:bg-maroon-bright"
            onClick={() => onPlan(term)}
          >
            Plan it
          </button>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs text-muted">
      <span className="text-faint">{label}: </span>
      {value}
    </div>
  )
}
