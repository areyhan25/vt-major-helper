const LETTER_ORDER = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A']

/** Grades that earn credit without a letter. VT's DARS accepts these for minimum-grade checks. */
const PASSING_NON_LETTER = new Set(['AP', 'TR', 'P', 'S', 'CR', 'T'])

export const IN_PROGRESS = 'IP'
/** A course planned for a future semester in Planner mode. Audited like an in-progress course. */
export const PLANNED = 'PL'

export function isInProgress(grade: string): boolean {
  return grade === IN_PROGRESS || grade === PLANNED
}

/** True when the course earned credit (or will, if in progress). */
export function countsForCredit(grade: string): boolean {
  if (isInProgress(grade) || PASSING_NON_LETTER.has(grade)) return true
  const i = LETTER_ORDER.indexOf(grade)
  return i > 0
}

/** True when `grade` meets `minGrade`. In-progress courses are assumed to meet it. */
export function meetsMinGrade(grade: string, minGrade?: string): boolean {
  if (!countsForCredit(grade)) return false
  if (!minGrade || isInProgress(grade) || PASSING_NON_LETTER.has(grade)) return true
  return LETTER_ORDER.indexOf(grade) >= LETTER_ORDER.indexOf(minGrade)
}

const POINTS: Record<string, number> = {
  A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0,
}

export function gradePoints(grade: string): number | undefined {
  return POINTS[grade]
}
