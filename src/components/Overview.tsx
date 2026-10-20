import type { AuditResult } from '../engine/audit'
import { Panel } from './ui'

export function StatTiles({ audit, whatIf }: { audit: AuditResult; whatIf: boolean }) {
  const { earned, inProgress, required } = audit.totalCredits
  const met = audit.sections.filter((s) => s.result.status === 'done').length
  const tiles = [
    { label: 'Credits earned', value: earned, sub: `of ${required} required` },
    { label: whatIf ? 'In progress + planned' : 'In progress', value: inProgress, sub: 'credits' },
    { label: 'Credits to go', value: Math.max(0, required - earned - inProgress), sub: 'after current courses' },
    { label: 'Requirement blocks met', value: `${met}/${audit.sections.length}`, sub: 'sections done' },
  ]
  return (
    <Panel className="grid grid-cols-2 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={`p-5 ${i % 2 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
        >
          <div className="text-sm text-muted">{t.label}</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">{t.value}</div>
          <div className="mt-1 text-xs text-faint">{t.sub}</div>
        </div>
      ))}
    </Panel>
  )
}

/** Semicircle gauge of degree progress: earned credits, then in-progress credits. */
export function ProgressGauge({ audit }: { audit: AuditResult }) {
  const { earned, inProgress, required } = audit.totalCredits
  const pctDone = Math.min(1, earned / required)
  const pctAll = Math.min(1, (earned + inProgress) / required)
  const r = 80
  const len = Math.PI * r
  const arc = `M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`

  return (
    <Panel className="p-5">
      <div className="text-sm text-muted">Degree progress</div>
      <svg viewBox="0 0 200 112" className="mx-auto mt-2 w-full max-w-64" role="img" aria-label={`${Math.round(pctDone * 100)}% of credits earned`}>
        <defs>
          <linearGradient id="vt" x1="0" x2="1">
            <stop offset="0" stopColor="#861f41" />
            <stop offset="1" stopColor="#e5751f" />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke="#2e2e33" strokeWidth="14" strokeLinecap="round" />
        <path d={arc} fill="none" stroke="#e5751f" strokeOpacity="0.35" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${pctAll * len} ${len}`} />
        <path d={arc} fill="none" stroke="url(#vt)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${pctDone * len} ${len}`} />
        <text x="100" y="92" textAnchor="middle" className="fill-ink text-[28px] font-semibold">
          {Math.round(pctDone * 100)}%
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>0</span>
        <span>{inProgress > 0 ? `+${Math.round((pctAll - pctDone) * 100)}% in progress` : 'credits earned'}</span>
        <span>{required}</span>
      </div>
    </Panel>
  )
}
