import { useState, type ReactNode } from 'react'
import type { AuditResult, RuleResult } from '../engine/audit'
import type { Rule } from '../engine/types'
import { CourseChip } from './CourseInfo'
import { Chevron, Chip, Dot, Panel, StatusKey } from './ui'

interface Props {
  audit: AuditResult
  titles: Record<string, string>
  whatIf: boolean
  onPlan?: (code: string, term: string) => void
  planTerms: string[]
}

export function AuditView({ audit, ...shared }: Props) {
  // Sections start open when they still need something.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const isOpen = (id: string, status: string) => open[id] ?? status !== 'done'
  const allOpen = audit.sections.every((s) => isOpen(s.section.id, s.result.status))

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Requirements</h2>
          <p className="text-sm text-muted">
            {audit.program.name} · {audit.program.catalogYear} catalog
          </p>
        </div>
        <button
          className="text-xs text-muted hover:text-ink"
          onClick={() =>
            setOpen(Object.fromEntries(audit.sections.map((s) => [s.section.id, !allOpen])))
          }
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="mt-3 rounded-lg bg-page/60 px-3 py-2">
        <StatusKey whatIf={shared.whatIf} />
      </div>

      <div className="mt-4 divide-y divide-line">
        {audit.sections.map(({ section, result }) => {
          const expanded = isOpen(section.id, result.status)
          return (
            <div key={section.id}>
              <button
                className="flex w-full items-center gap-3 py-3 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [section.id]: !expanded }))}
              >
                <Chevron open={expanded} />
                <span className="min-w-0 flex-1 font-medium">{section.title}</span>
                <Chip status={result.status} />
              </button>
              {expanded && (
                <div className="pb-4 pl-7">
                  {section.note && <p className="mb-2 text-xs text-faint">{section.note}</p>}
                  <RuleView result={result} top {...shared} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {audit.program.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-0.5 border-t border-line pl-5 pt-4 text-xs text-faint">
          {audit.program.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

type Shared = Omit<Props, 'audit'>

function RuleView({ result, top = false, ...shared }: { result: RuleResult; top?: boolean } & Shared) {
  const { rule } = result
  // A section's top-level "all of" is just the list of its requirements.
  if (rule.type === 'allOf' && top) {
    return (
      <ul className="space-y-3">
        {result.children!.map((c, i) => (
          <li key={i}>
            <RuleView result={c} {...shared} />
          </li>
        ))}
      </ul>
    )
  }

  const opts = result.status === 'needed' ? options(rule) : []

  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-1.5">
        <Dot status={result.status} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {rule.type === 'course' && !rule.label ? (
            <span>
              <CourseChip
                code={rule.course}
                variant="heading"
                {...shared}
                onPlan={shared.whatIf && result.status === 'needed' ? shared.onPlan : undefined}
              />
              {rule.minGrade && <span className="ml-1.5 text-xs text-muted">{rule.minGrade} or better</span>}
              {result.used[0] && (
                <span className="ml-1.5 text-xs text-faint">
                  · {result.used[0].grade} in {result.used[0].term}
                </span>
              )}
            </span>
          ) : (
            <span className="font-medium">{describe(rule)}</span>
          )}
          {result.required !== undefined && result.required > 0 && (
            <span className="text-xs text-muted">
              {result.earned}
              {result.inProgress ? ` + ${result.inProgress}` : ''} / {result.required} cr
            </span>
          )}
        </div>
        {result.used.length > 0 && !(rule.type === 'course' && !rule.label) && (
          <ChipRow>
            {result.used.map((c) => (
              <CourseChip key={`${c.term}|${c.code}`} code={c.code} taken={c} variant="used" {...shared} />
            ))}
          </ChipRow>
        )}
        {opts.length > 0 && (
          <ChipRow label="Options">
            {opts.map((code) => (
              <CourseChip key={code} code={code} {...shared} onPlan={shared.whatIf ? shared.onPlan : undefined} />
            ))}
          </ChipRow>
        )}
        {result.note && <div className="text-xs text-needed">{result.note}</div>}
        {rule.type === 'allOf' && result.status !== 'done' && (
          <ul className="space-y-2 border-l border-line pl-3">
            {result.children!.map((c, i) => (
              <li key={i}>
                <RuleView result={c} {...shared} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ChipRow({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="text-xs text-faint">{label}:</span>}
      {children}
    </div>
  )
}

function describe(rule: Rule): string {
  if (rule.label) return rule.label
  switch (rule.type) {
    case 'course':
      return rule.minGrade ? `${rule.course} (${rule.minGrade} or better)` : rule.course
    case 'credits':
      return rule.pathways ? `${rule.credits} credits of Pathways ${rule.pathways.join(' or ')}` : `${rule.credits} credits`
    case 'anyOf':
      return rule.rules.map(describe).join(' or ')
    case 'allOf':
      return rule.rules.map(describe).join(' and ')
  }
}

/** Course codes that would satisfy a rule, for "what can I take?". */
function options(rule: Rule): string[] {
  switch (rule.type) {
    case 'course':
      return rule.label ? [rule.course] : []
    case 'credits':
      return rule.from ?? []
    case 'anyOf':
      return [...new Set(rule.rules.flatMap(leafCodes))]
    case 'allOf':
      return []
  }
}

function leafCodes(rule: Rule): string[] {
  if (rule.type === 'course') return [rule.course]
  if (rule.type === 'credits') return rule.from ?? []
  return rule.rules.flatMap(leafCodes)
}
