import type { AuditResult, RuleResult, Status } from '../engine/audit'
import type { Rule } from '../engine/types'

const STATUS: Record<Status, { label: string; chip: string; dot: string }> = {
  done: { label: 'Done', chip: 'bg-green-100 text-green-800', dot: 'bg-green-600' },
  'in-progress': { label: 'In progress', chip: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  needed: { label: 'Needed', chip: 'bg-red-100 text-red-800', dot: 'bg-red-600' },
}

export function AuditView({ audit }: { audit: AuditResult }) {
  const { earned, inProgress, required } = audit.totalCredits
  const pct = (n: number) => `${Math.min(100, (n / required) * 100)}%`
  const remaining = Math.max(0, required - earned - inProgress)

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {audit.program.name} <span className="font-normal text-stone-500">· {audit.program.catalogYear} catalog</span>
          </h2>
          <Chip status={audit.status} />
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-200">
          <div className="bg-green-600" style={{ width: pct(earned) }} />
          <div className="bg-amber-400" style={{ width: pct(inProgress) }} />
        </div>
        <p className="mt-2 text-sm text-stone-600">
          <b className="text-stone-800">{earned}</b> credits earned, <b className="text-stone-800">{inProgress}</b> in
          progress, <b className="text-stone-800">{remaining}</b> to go of {required}.
        </p>
        {audit.program.notes.length > 0 && (
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-stone-500">
            {audit.program.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>

      {audit.sections.map(({ section, result }) => (
        <details
          key={section.id}
          open={result.status !== 'done'}
          className="group rounded-xl border border-stone-200 bg-white shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <span className="font-medium">{section.title}</span>
            <Chip status={result.status} />
          </summary>
          <div className="border-t border-stone-100 px-4 pb-4 pt-2">
            {section.note && <p className="mb-2 text-xs text-stone-500">{section.note}</p>}
            <RuleView result={result} top />
          </div>
        </details>
      ))}

      {audit.unused.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium">Free electives</h3>
          <p className="mt-1 text-sm text-stone-600">
            These count toward your total credits but not a specific requirement:{' '}
            {audit.unused.map((c) => c.code).join(', ')}.
          </p>
        </div>
      )}
    </section>
  )
}

function Chip({ status }: { status: Status }) {
  const s = STATUS[status]
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.chip}`}>{s.label}</span>
}

function RuleView({ result, top = false }: { result: RuleResult; top?: boolean }) {
  const { rule } = result
  // A section's top-level "all of" is just the list of its requirements.
  if (rule.type === 'allOf' && top) {
    return (
      <ul className="space-y-1.5">
        {result.children!.map((c, i) => (
          <li key={i}>
            <RuleView result={c} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS[result.status].dot}`} />
      <div className="min-w-0">
        <div>
          <span className="font-medium">{describe(rule)}</span>
          {result.required !== undefined && result.required > 0 && (
            <span className="ml-2 text-stone-500">
              {result.earned}
              {result.inProgress ? ` + ${result.inProgress} in progress` : ''} / {result.required} cr
            </span>
          )}
        </div>
        {result.used.length > 0 && (
          <div className="text-xs text-stone-500">
            Used: {result.used.map((c) => `${c.code} (${c.grade})`).join(', ')}
          </div>
        )}
        {result.status === 'needed' && options(rule) && (
          <div className="text-xs text-stone-500">Options: {options(rule)}</div>
        )}
        {result.note && <div className="text-xs text-red-700">{result.note}</div>}
        {rule.type === 'allOf' && result.status !== 'done' && (
          <ul className="mt-1 space-y-1 border-l border-stone-200 pl-3">
            {result.children!.map((c, i) => (
              <li key={i}>
                <RuleView result={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
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

/** A short list of courses that would satisfy a rule, for "what can I take?". */
function options(rule: Rule): string | undefined {
  if (rule.type === 'credits' && rule.from) {
    const list = rule.from.map((p) => p.replace(/\*+$/, 'XXX'))
    return list.length > 8 ? `${list.slice(0, 8).join(', ')}, and ${list.length - 8} more` : list.join(', ')
  }
  if (rule.type === 'anyOf' && rule.label) return rule.rules.map(describe).join(', ')
  return undefined
}
