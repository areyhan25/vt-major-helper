import { termOrder } from './terms'
import type { TakenCourse } from './types'

/** Group key for AP and transfer credit earned before the student's first VT semester. */
export const PRIOR = 'PRIOR'

const isCreditByExamOrTransfer = (c: TakenCourse) => c.grade === 'AP' || c.grade === 'TR'

/**
 * The semester block a course belongs in. AP and transfer credit dated on or before the
 * first semester with VT coursework goes in its own "prior credit" block, since DARS
 * dates AP credit to the term it was posted, not when it was earned.
 */
export function semesterKeyFor(courses: TakenCourse[]): (c: TakenCourse) => string {
  const vtTerms = courses.filter((c) => !isCreditByExamOrTransfer(c) && termOrder(c.term) >= 0).map((c) => termOrder(c.term))
  const first = vtTerms.length ? Math.min(...vtTerms) : Infinity
  return (c) => (isCreditByExamOrTransfer(c) && termOrder(c.term) <= first ? PRIOR : c.term)
}
