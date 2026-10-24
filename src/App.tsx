import { useEffect, useMemo, useState } from 'react'
import { AuditView } from './components/AuditView'
import { AutoPlan } from './components/AutoPlan'
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
import { load, save, type Mode, type Tab } from './storage'

export default function App() {
  const [saved] = useState(load)
  const [programId, setProgramId] = useState<string | undefined>(saved.programId)
  const [courses, setCourses] = useState<TakenCourse[]>(saved.courses)
  const [mode, setMode] = useState<Mode>(saved.mode ?? 'current')
  // Planner mode's future courses. Older saves kept them inside a full copy of the courses.
  const [planned, setPlanned] = useState<TakenCourse[]>(
    saved.planned ?? saved.plan?.filter((c) => c.grade === PLANNED) ?? [],
  )
  // What-if mode's scratch copy of the courses and major. Never saved, and dropped on leaving.
  const [whatIf, setWhatIf] = useState<{ courses: TakenCourse[]; programId: string }>()
  const [planTerms, setPlanTerms] = useState<string[]>(saved.planTerms ?? [])
  const [planMax, setPlanMax] = useState(saved.planMax ?? 16)
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
    () => save({ programId, courses, planned, planTerms, planMax, mode: mode === 'whatif' ? 'current' : mode, tab, expected }),
    [programId, courses, planned, planTerms, planMax, mode, tab, expected],
  )

  // Undefined until a major is picked on the welcome page.
  const picked = programs.find((p) => p.id === programId)
  const realProgram = picked ?? programs[0]
  const program = (mode === 'whatif' && programs.find((p) => p.id === whatIf?.programId)) || realProgram
  const active = useMemo(
    () => (mode === 'whatif' && whatIf ? whatIf.courses : mode === 'planner' ? [...courses, ...planned] : courses),
    [mode, whatIf, courses, planned],
  )
  const audit = useMemo(() => runAudit(program, active, courseInfo), [program, active])

  // Auto-plan's elective slots aren't real courses yet.
  const freeElectives = audit.unused.filter((c) => !c.autoPlan?.slot)

  const titles = useMemo(
    () => Object.fromEntries(active.filter((c) => c.title).map((c) => [c.code, c.title!])),
    [active],
  )

  // Semesters a course can be planned into: the plan's own future ones, then the next few after.
  const lastTerm = [...active.map((c) => c.term), ...planTerms].sort((a, b) => termOrder(a) - termOrder(b)).at(-1) ?? ''
  const futureTerms = [...new Set([...planTerms, ...active.filter((c) => c.grade === PLANNED).map((c) => c.term), ...termsAfter(lastTerm, 4)])].sort(
    (a, b) => termOrder(a) - termOrder(b),
  )

  function switchMode(next: Mode) {
    // What-if starts fresh from the real record every time.
    setWhatIf(next === 'whatif' ? { courses, programId: realProgram.id } : undefined)
    setMode(next)
  }

  function clearPlan() {
    setPlanned([])
    setPlanTerms([])
  }

  /** Clears the courses, the plan, and the chosen major, which brings back the welcome page. */
  function startOver() {
    setCourses([])
    setPlanned([])
    setPlanTerms([])
    setWhatIf(undefined)
    setMode('current')
    setProgramId(undefined)
    setExpected({})
    setConfirmingReset(false)
  }

  const majorSelect = (
    <select
      className="w-full min-w-0 rounded-lg border border-line bg-raised px-2.5 py-2 text-sm text-ink focus:border-burnt focus:outline-none"
      value={program.id}
      onChange={(e) =>
        mode === 'whatif' && whatIf ? setWhatIf({ ...whatIf, programId: e.target.value }) : setProgramId(e.target.value)
      }
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

  const modeSwitch = (
    <section aria-labelledby="modes-heading">
      <h2 id="modes-heading" className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Modes
      </h2>
      <ModeSwitch mode={mode} onChange={switchMode} />
    </section>
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
        <p className="mt-auto text-xs leading-relaxed text-faint">
          Unofficial planning tool. Always check your official DARS and talk with your advisor. Your courses stay in
          this browser.
        </p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="space-y-3 border-b border-line bg-panel p-4 lg:hidden">
          <Brand />
          {majorSelect}
          {tabSwitch}
        </header>

        <main className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
          {modeSwitch}

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

          {mode === 'whatif' && (
            <ModeBanner
              title="What-if mode."
              text="Change grades, add a retake, or try another major from the menu. Nothing is saved, and it resets when you leave."
              action="Reset"
              onAction={() => setWhatIf({ courses, programId: realProgram.id })}
            />
          )}
          {mode === 'planner' && (
            <ModeBanner
              tone="planner"
              title="Planner."
              text="Add future semesters and drag courses between them. Your plan is saved in this browser and never changes your real courses."
              action="Clear plan"
              onAction={clearPlan}
            />
          )}
          {mode === 'planner' && tab === 'audit' && (
            <AutoPlan
              program={program}
              courses={courses}
              planned={planned}
              info={courseInfo}
              maxCredits={planMax}
              onMaxCredits={setPlanMax}
              onPlanned={setPlanned}
            />
          )}

          {tab === 'audit' ? (
            <>
              <StatTiles audit={audit} planning={mode === 'planner'} />

              <div className="grid gap-6 lg:grid-cols-3">
                <div id="requirements" className="scroll-mt-6 lg:col-span-2">
                  <AuditView
                    audit={audit}
                    titles={titles}
                    planning={mode === 'planner'}
                    planTerms={futureTerms}
                    onPlan={
                      mode === 'planner'
                        ? (code, term) => setPlanned((p) => [...p, { code, term, credits: 3, grade: PLANNED }])
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-6">
                  <ProgressGauge audit={audit} />
                  {mode === 'current' && (
                    <ImportDars
                      program={program}
                      onImport={(imported) => {
                        setCourses(imported)
                        // Planned courses that now show up on the DARS aren't planned anymore.
                        setPlanned((p) => p.filter((c) => !imported.some((i) => i.code === c.code)))
                      }}
                    />
                  )}
                  {freeElectives.length > 0 && (
                    <Panel className="p-5">
                      <div className="text-sm text-muted">Free electives</div>
                      <p className="mt-2 text-sm">
                        These count toward total credits but not a specific requirement:
                      </p>
                      <p className="mt-2 text-sm font-medium">{freeElectives.map((c) => c.code).join(', ')}</p>
                    </Panel>
                  )}
                </div>
              </div>

              <div id="semesters" className="scroll-mt-6">
                <SemesterBoard
                  courses={active}
                  onChange={
                    mode === 'whatif'
                      ? (next) => setWhatIf({ programId: program.id, courses: next })
                      : mode === 'planner'
                        ? (next) => setPlanned(next.filter((c) => c.grade === PLANNED))
                        : setCourses
                  }
                  mode={mode}
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
              planning={mode === 'planner'}
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

const MODES: [Mode, string][] = [
  ['whatif', 'What-If'],
  ['current', 'Current'],
  ['planner', 'Planner'],
]

/** One long three-way switch, with a thumb that slides to the picked mode. */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const index = MODES.findIndex(([id]) => id === mode)
  return (
    <div role="radiogroup" aria-label="Mode" className="relative grid grid-cols-3 rounded-full border border-line bg-raised p-1 text-sm">
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full shadow-md transition-all duration-300 ease-out motion-reduce:transition-none ${
          mode === 'current' ? 'bg-line' : mode === 'whatif' ? 'bg-burnt shadow-burnt/30' : 'bg-maroon shadow-maroon/40'
        }`}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {MODES.map(([id, label]) => (
        <button
          key={id}
          role="radio"
          aria-checked={mode === id}
          onClick={() => onChange(id)}
          className={`relative rounded-full px-3 py-2 font-medium transition-colors ${
            mode === id ? (id === 'whatif' ? 'text-black' : 'text-white') : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

interface BannerProps {
  tone?: 'whatif' | 'planner'
  title: string
  text: string
  action: string
  onAction: () => void
}

/** The strip under the Overview heading saying which mode is on, colored to match the switch. */
function ModeBanner({ tone = 'whatif', title, text, action, onAction }: BannerProps) {
  const planner = tone === 'planner'
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        planner ? 'border-maroon-bright/60 bg-maroon/15' : 'border-burnt/40 bg-burnt/10'
      }`}
    >
      <span className={planner ? 'text-ink' : 'text-burnt-soft'}>
        <b className="font-semibold">{title}</b> {text}
      </span>
      <button
        className={`rounded-lg border px-3 py-1 ${planner ? 'border-maroon-bright/60 hover:bg-maroon/30' : 'border-burnt/40 hover:bg-burnt/15'}`}
        onClick={onAction}
      >
        {action}
      </button>
    </div>
  )
}
