import type { TakenCourse } from './engine/types'

const KEY = 'vt-major-helper:v1'

export interface Saved {
  programId?: string
  courses: TakenCourse[]
  /** What-if mode's copy of the courses, kept separate from the real record. */
  plan?: TakenCourse[]
  /** Empty future semesters added in What-if mode. */
  planTerms?: string[]
  whatIf?: boolean
  /** Which tab is open. */
  tab?: Tab
  /** Expected grades for in-progress and planned courses, used by the GPA calculator. */
  expected?: Record<string, string>
}

export type Tab = 'audit' | 'gpa'

/** Everything stays in this browser. Storage can be unavailable (private windows), so failures are ignored. */
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    // fall through
  }
  return { courses: [] }
}

export function save(state: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
