import { useState, type FormEvent } from 'react'
import { termOrder } from '../engine/audit'
import { normalizeCode } from '../engine/match'
import type { TakenCourse } from '../engine/types'

interface Props {
  courses: TakenCourse[]
  onChange: (courses: TakenCourse[]) => void
}

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'AP', 'TR', 'IP', 'W']

export function CourseList({ courses, onChange }: Props) {
  const [code, setCode] = useState('')
  const [credits, setCredits] = useState('3')
  const [grade, setGrade] = useState('A')
  const [term, setTerm] = useState('')

  const sorted = [...courses].sort((a, b) => termOrder(a.term) - termOrder(b.term) || a.code.localeCompare(b.code))

  function add(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizeCode(code)
    if (!/^[A-Z]{2,5} [0-9X]{4}[A-Z]?$/.test(normalized)) return
    onChange([...courses, { code: normalized, credits: Number(credits) || 0, grade, term: term.trim().toUpperCase() }])
    setCode('')
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Your courses</h2>
        {courses.length > 0 && (
          <button className="text-xs text-stone-500 hover:text-red-700" onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>

      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 text-sm">
        <input
          className="min-w-0 flex-1 basis-28 rounded-md border border-stone-300 px-2 py-1.5"
          placeholder="CS 1114"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Course"
        />
        <input
          className="w-14 rounded-md border border-stone-300 px-2 py-1.5"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          inputMode="decimal"
          aria-label="Credits"
        />
        <select
          className="w-16 rounded-md border border-stone-300 px-1 py-1.5"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          aria-label="Grade"
        >
          {GRADES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <input
          className="w-16 rounded-md border border-stone-300 px-2 py-1.5"
          placeholder="26SP"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Term"
        />
        <button className="rounded-md bg-stone-800 px-3 py-1.5 font-medium text-white hover:bg-stone-700">Add</button>
      </form>

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">No courses yet. Import your DARS or add them above.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="pb-1 font-medium">Term</th>
              <th className="pb-1 font-medium">Course</th>
              <th className="pb-1 pr-2 text-right font-medium">Cr</th>
              <th className="pb-1 text-right font-medium">Grade</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={`${c.term}|${c.code}`} className="border-t border-stone-100">
                <td className="py-1 pr-2 text-stone-500">{c.term || '—'}</td>
                <td className="py-1">
                  <span className="font-medium">{c.code}</span>
                  {c.title && <span className="ml-2 hidden text-stone-500 sm:inline">{c.title}</span>}
                </td>
                <td className="py-1 pr-2 text-right">{c.credits}</td>
                <td className="py-1 text-right">{c.grade}</td>
                <td className="py-1 text-right">
                  <button
                    className="px-1 text-stone-400 hover:text-red-700"
                    aria-label={`Remove ${c.code}`}
                    onClick={() => onChange(courses.filter((x) => x !== c))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
