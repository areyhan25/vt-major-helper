import { useEffect, useMemo, useState } from 'react'
import { AuditView } from './components/AuditView'
import { CourseList } from './components/CourseList'
import { ImportDars } from './components/ImportDars'
import { comingSoon, courseInfo, programs } from './data'
import { runAudit } from './engine/audit'
import type { TakenCourse } from './engine/types'
import { load, save } from './storage'

export default function App() {
  const [saved] = useState(load)
  const [programId, setProgramId] = useState(saved.programId ?? programs[0].id)
  const [courses, setCourses] = useState<TakenCourse[]>(saved.courses)

  useEffect(() => save({ programId, courses }), [programId, courses])

  const program = programs.find((p) => p.id === programId) ?? programs[0]
  const audit = useMemo(() => runAudit(program, courses, courseInfo), [program, courses])

  return (
    <div className="min-h-screen">
      <header className="bg-maroon text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">VT Major Helper</h1>
            <p className="text-sm text-white/80">See what you've finished and what's left for your major.</p>
          </div>
          <label className="flex min-w-0 max-w-full items-center gap-2 text-sm">
            <span className="text-white/80">Major</span>
            <select
              className="min-w-0 max-w-full rounded-md bg-white px-2 py-1.5 text-stone-800"
              value={program.id}
              onChange={(e) => setProgramId(e.target.value)}
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
          </label>
        </div>
      </header>

      <main className="mx-auto grid min-w-0 max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <ImportDars
            onImport={(imported, matched) => {
              setCourses(imported)
              if (matched) setProgramId(matched.id)
            }}
            program={program}
          />
          <CourseList courses={courses} onChange={setCourses} />
        </div>
        <AuditView audit={audit} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-stone-500">
        This is an unofficial planning tool. Always check your official DARS audit and talk with your advisor. Your
        courses are stored only in this browser.
      </footer>
    </div>
  )
}
