import { courseInfo } from '../data'
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
  /** In What-if mode: add this course to a planned semester. */
  onPlan?: (code: string, term: string) => void
  planTerms?: string[]
  variant?: 'option' | 'used' | 'heading'
}

/** A course code chip that opens a card with what we know about the course and a catalog link. */
export function CourseChip({ code, taken, titles, onPlan, planTerms = [], variant = 'option' }: Props) {
  const isPattern = /[*X]/.test(code.split(' ')[1] ?? '')
  const title = taken?.title ?? titles[code]
  const pathways = courseInfo[code]?.pathways
  const [picked, setTerm] = useState<string>()
  const term = picked && planTerms.includes(picked) ? picked : planTerms[0]

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
          {pathways && <div className="text-xs text-muted">Pathways: {pathways.join(', ')}</div>}
          {!title && !isPattern && (
            <div className="text-xs text-faint">Title and description are in the VT catalog.</div>
          )}
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
                onClick={() => {
                  onPlan(code, term)
                  close()
                }}
              >
                Plan it
              </button>
            </div>
          )}
        </div>
      )}
    </Popover>
  )
}
