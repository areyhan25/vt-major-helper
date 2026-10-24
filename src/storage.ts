import type { TakenCourse } from './engine/types'

const KEY = 'vt-major-helper:v1'

export interface Saved {
  programId?: string
  /** False while the "Add your courses" page is up, between picking a major and the audit. */
  started?: boolean
  courses: TakenCourse[]
  /** Planner mode's future courses, all graded PL. Kept apart from the real record. */
  planned?: TakenCourse[]
  /** Empty future semesters added in Planner mode. */
  planTerms?: string[]
  /** Auto-plan's credit limit per semester. */
  planMax?: number
  /** What-if mode isn't saved, since it resets when you leave it. */
  mode?: Exclude<Mode, 'whatif'>
  /** Older saves: What-if mode's full copy of the courses, which held the planned ones. */
  plan?: TakenCourse[]
  /** Which tab is open. */
  tab?: Tab
  /** Expected grades for in-progress and planned courses, used by the GPA calculator. */
  expected?: Record<string, string>
}

export type Tab = 'audit' | 'gpa'

export type Mode = 'whatif' | 'current' | 'planner'

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
