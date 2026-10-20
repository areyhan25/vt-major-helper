import { useEffect, useMemo, useState } from 'react'
import { AuditView } from './components/AuditView'
import { GpaView } from './components/GpaView'
import { ImportDars } from './components/ImportDars'
import { ProgressGauge, StatTiles } from './components/Overview'
import { SemesterBoard } from './components/SemesterBoard'
import { MajorLoading, Welcome } from './components/Welcome'
import { Panel } from './components/ui'
import { comingSoon, courseInfo, programs } from './data'
import { runAudit } from './engine/audit'
import { PLANNED } from './engine/grades'
import { termOrder, termsAfter } from './engine/terms'
import type { TakenCourse } from './engine/types'
import { load, save, type Tab } from './storage'

export default function App() {
  const [saved] = useState(load)
  const [programId, setProgramId] = useState<string | undefined>(saved.programId)
  const [courses, setCourses] = useState<TakenCourse[]>(saved.courses)
  const [whatIf, setWhatIf] = useState(saved.whatIf ?? false)
  // null until What-if mode is first opened, then a separate copy of the courses.
  const [plan, setPlan] = useState<TakenCourse[] | null>(saved.plan ?? null)
  const [planTerms, setPlanTerms] = useState<string[]>(saved.planTerms ?? [])
  const [tab, setTab] = useState<Tab>(saved.tab ?? 'audit')
  const [expected, setExpected] = useState(saved.expected ?? {})
  const [confirmingReset, setConfirmingReset] = useState(false)
  // True for a moment after a major is picked on the welcome page.
  const [loading, setLoading] = useState(false)
  // Fade the app in when it replaces the loading screen, but not on a plain page load.
  const [fadeIn, setFadeIn] = useState(false)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(
    () => save({ programId, courses, plan: plan ?? undefined, planTerms, whatIf, tab, expected }),
    [programId, courses, plan, planTerms, whatIf, tab, expected],
  )

  // Undefined until a major is picked on the welcome page.
  const picked = programs.find((p) => p.id === programId)
  const program = picked ?? programs[0]
  const active = whatIf && plan ? plan : courses
  const audit = useMemo(() => runAudit(program, active, courseInfo), [program, active])

  const titles = useMemo(
    () => Object.fromEntries(active.filter((c) => c.title).map((c) => [c.code, c.title!])),
    [active],
  )

  // Semesters a course can be planned into: the plan's own future ones, then the next few after.
  const lastTerm = [...active.map((c) => c.term), ...planTerms].sort((a, b) => termOrder(a) - termOrder(b)).at(-1) ?? ''
  const futureTerms = [...new Set([...planTerms, ...active.filter((c) => c.grade === PLANNED).map((c) => c.term), ...termsAfter(lastTerm, 4)])].sort(
    (a, b) => termOrder(a) - termOrder(b),
  )

  function startWhatIf() {
    if (!plan) setPlan(courses)
    setWhatIf(true)
  }

  function resetPlan() {
    setPlan(courses)
    setPlanTerms([])
  }

  /** Clears the courses, the What-if plan, and the chosen major, which brings back the welcome page. */
  function startOver() {
    setCourses([])
    setPlan(null)
    setPlanTerms([])
    setWhatIf(false)
    setProgramId(undefined)
    setExpected({})
    setConfirmingReset(false)
  }

  const majorSelect = (
    <select
      className="w-full min-w-0 rounded-lg border border-line bg-raised px-2.5 py-2 text-sm text-ink focus:border-burnt focus:outline-none"
      value={program.id}
      onChange={(e) => setProgramId(e.target.value)}
      aria-label="Major"
    >
      {programs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.catalogYear})
        </option>
      ))}
      {comingSoon.map((name) => (
        <option key={name} disabled>
          {name} (coming soon)
        </option>
      ))}
    </select>
  )

  const whatIfToggle = (
    <button
      role="switch"
      aria-checked={whatIf}
      onClick={() => (whatIf ? setWhatIf(false) : startWhatIf())}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        whatIf ? 'bg-burnt/15 text-burnt-soft' : 'text-muted hover:bg-raised hover:text-ink'
      }`}
    >
      What-if mode
      <span className={`relative h-5 w-9 rounded-full transition-colors ${whatIf ? 'bg-burnt' : 'bg-line'}`}>
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${whatIf ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )

  const tabs: [Tab, string][] = [
    ['audit', 'Degree audit'],
    ['gpa', 'GPA calculator'],
  ]

  const tabSwitch = (
    <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 rounded-lg bg-raised p-1 text-sm">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            tab === id ? 'bg-burnt text-black' : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (!picked)
    return (
      <Welcome
        programs={programs}
        onPick={(id) => {
          setProgramId(id)
          setLoading(true)
          setFadeIn(true)
        }}
      />
    )
  if (loading) return <MajorLoading program={picked} />

  return (
    <div className={`flex min-h-screen ${fadeIn ? 'app-fade-in' : ''}`}>
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-line bg-panel p-5 lg:flex">
        <Brand />
        <div className="mt-8">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Major</div>
          {majorSelect}
        </div>
        <nav className="mt-8 space-y-1 text-sm">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">View</div>
          {tabs.map(([id, label]) => (
            <div key={id}>
              <button
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`block w-full rounded-lg px-3 py-2 text-left ${
                  tab === id ? 'bg-raised font-medium text-ink' : 'text-muted hover:bg-raised hover:text-ink'
                }`}
              >
                {label}
              </button>
              {id === 'audit' && tab === 'audit' && (
                <div className="ml-3 border-l border-line pl-2">
                  {[
                    ['#overview', 'Overview'],
                    ['#requirements', 'Requirements'],
                    ['#semesters', 'Semesters'],
                  ].map(([href, label]) => (
                    <a
                      key={href}
                      href={href}
                      className="block rounded-lg px-3 py-1.5 text-muted hover:bg-raised hover:text-ink"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="mt-6">{whatIfToggle}</div>
        <p className="mt-auto text-xs leading-relaxed text-faint">
          Unofficial planning tool. Always check your official DARS and talk with your advisor. Your courses stay in
          this browser.
        </p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="space-y-3 border-b border-line bg-panel p-4 lg:hidden">
          <Brand />
          {majorSelect}
          {whatIfToggle}
          {tabSwitch}
        </header>

        <main className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
          {tab === 'audit' && (
            <div id="overview" className="flex scroll-mt-6 items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
              {confirmingReset ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Clear all courses and your major?</span>
                  <button className="rounded-lg bg-needed px-3 py-1.5 font-medium text-white" onClick={startOver}>
                    Clear
                  </button>
                  <button
                    className="rounded-lg border border-line px-3 py-1.5 text-muted hover:text-ink"
                    onClick={() => setConfirmingReset(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-needed hover:text-needed"
                  onClick={() => setConfirmingReset(true)}
                >
                  Start over
                </button>
              )}
            </div>
          )}

          {whatIf && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-burnt/40 bg-burnt/10 px-4 py-3 text-sm">
              <span className="text-burnt-soft">
                <b className="font-semibold">What-if mode.</b> Changes here are a separate plan and don't touch your
                real courses.
              </span>
              <span className="flex gap-2">
                <button className="rounded-lg border border-burnt/40 px-3 py-1 hover:bg-burnt/15" onClick={resetPlan}>
                  Reset plan
                </button>
                <button className="rounded-lg bg-burnt px-3 py-1 font-medium text-black" onClick={() => setWhatIf(false)}>
                  Exit
                </button>
              </span>
            </div>
          )}

          {tab === 'audit' ? (
            <>
              <StatTiles audit={audit} whatIf={whatIf} />

              <div className="grid gap-6 lg:grid-cols-3">
                <div id="requirements" className="scroll-mt-6 lg:col-span-2">
                  <AuditView
                    audit={audit}
                    titles={titles}
                    whatIf={whatIf}
                    planTerms={futureTerms}
                    onPlan={(code, term) => {
                      setPlan((p) => [...(p ?? courses), { code, term, credits: 3, grade: PLANNED }])
                    }}
                  />
                </div>
                <div className="space-y-6">
                  <ProgressGauge audit={audit} />
                  {!whatIf && (
                    <ImportDars
                      program={program}
                      onImport={(imported) => {
                        setCourses(imported)
                        setPlan(imported)
                        setPlanTerms([])
                      }}
                    />
                  )}
                  {audit.unused.length > 0 && (
                    <Panel className="p-5">
                      <div className="text-sm text-muted">Free electives</div>
                      <p className="mt-2 text-sm">
                        These count toward total credits but not a specific requirement:
                      </p>
                      <p className="mt-2 text-sm font-medium">{audit.unused.map((c) => c.code).join(', ')}</p>
                    </Panel>
                  )}
                </div>
              </div>

              <div id="semesters" className="scroll-mt-6">
                <SemesterBoard
                  courses={active}
                  onChange={whatIf ? setPlan : setCourses}
                  whatIf={whatIf}
                  extraTerms={planTerms}
                  onExtraTerms={setPlanTerms}
                />
              </div>
            </>
          ) : (
            <GpaView
              courses={active}
              expected={expected}
              onExpected={setExpected}
              creditsToGo={Math.max(0, audit.totalCredits.required - audit.totalCredits.earned - audit.totalCredits.inProgress)}
              whatIf={whatIf}
            />
          )}

          <p className="pb-4 text-xs text-faint lg:hidden">
            Unofficial planning tool. Always check your official DARS and talk with your advisor. Your courses stay in
            this browser.
          </p>
        </main>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-maroon to-burnt text-sm font-bold text-white shadow-lg shadow-maroon/30">
        VT
      </div>
      <div>
        <div className="font-semibold leading-tight">Major Helper</div>
        <div className="text-xs text-faint">Degree audit and planner</div>
      </div>
    </div>
  )
}
