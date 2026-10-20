import { gradePoints, isInProgress } from './grades'
import { termOrder } from './terms'
import type { TakenCourse } from './types'

/** Letter grades a student can pick as the expected grade for an in-progress or planned course. */
export const LETTER_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']

/** Expected grades for in-progress and planned courses, keyed by `expectedKey`. */
export type ExpectedGrades = Record<string, string>

export const expectedKey = (c: TakenCourse) => `${c.term}|${c.code}`

export interface GpaTotals {
  /** Credit hours that count toward GPA: letter-graded courses only. */
  hours: number
  qualityPoints: number
  /** Undefined until there is at least one letter-graded credit. */
  gpa?: number
}

export interface TermGpa {
  term: string
  semester: GpaTotals
  cumulative: GpaTotals
  /** True when the term uses an expected grade for a course that isn't finished. */
  projected: boolean
}

/**
 * The letter grade a course contributes to GPA, or undefined when it doesn't count.
 * Only A through F count. P, AP, TR, W and the like earn credit (or don't) without affecting GPA.
 * In-progress and planned courses count only when an expected grade is given.
 */
export function gpaGrade(c: TakenCourse, expected: ExpectedGrades = {}): string | undefined {
  const grade = isInProgress(c.grade) ? expected[expectedKey(c)] : c.grade
  return grade !== undefined && gradePoints(grade) !== undefined ? grade : undefined
}

function totals(hours: number, qualityPoints: number): GpaTotals {
  return { hours, qualityPoints, gpa: hours > 0 ? qualityPoints / hours : undefined }
}

/** GPA over the courses. Every attempt of a repeated course counts, since VT has no grade replacement. */
export function computeGpa(courses: TakenCourse[], expected: ExpectedGrades = {}): GpaTotals {
  let hours = 0
  let points = 0
  for (const c of courses) {
    const grade = gpaGrade(c, expected)
    if (grade === undefined) continue
    hours += c.credits
    points += c.credits * gradePoints(grade)!
  }
  return totals(hours, points)
}

/** Term GPA and running cumulative GPA for each semester with letter-graded credit, oldest first. */
export function termGpas(courses: TakenCourse[], expected: ExpectedGrades = {}): TermGpa[] {
  const terms = [...new Set(courses.filter((c) => gpaGrade(c, expected) !== undefined).map((c) => c.term))].sort(
    (a, b) => termOrder(a) - termOrder(b),
  )
  let hours = 0
  let points = 0
  return terms.map((term) => {
    const inTerm = courses.filter((c) => c.term === term)
    const t = computeGpa(inTerm, expected)
    hours += t.hours
    points += t.qualityPoints
    return {
      term,
      semester: t,
      cumulative: totals(hours, points),
      projected: inTerm.some((c) => isInProgress(c.grade) && gpaGrade(c, expected) !== undefined),
    }
  })
}

/**
 * The average grade points needed over `moreHours` new letter-graded credits to finish at `target`.
 * Can come out above 4.0 (out of reach) or below 0 (reached whatever happens).
 */
export function requiredAverage(current: GpaTotals, target: number, moreHours: number): number | undefined {
  if (moreHours <= 0) return undefined
  return (target * (current.hours + moreHours) - current.qualityPoints) / moreHours
}

/** "3.456". GPAs are shown to three places, like DARS. */
export function formatGpa(gpa: number | undefined): string {
  return gpa === undefined ? '—' : (Math.floor(gpa * 1000 + 1e-9) / 1000).toFixed(3)
}
