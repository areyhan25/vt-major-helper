import { normalizeCode } from '../engine/match'
import type { TakenCourse } from '../engine/types'

export interface DarsImport {
  /** e.g. "BSCS CS" */
  programCode?: string
  /** e.g. "BACHELOR OF SCIENCE IN COMPUTER SCIENCE" */
  degreeTitle?: string
  /** e.g. "Fall 2025" */
  catalogYear?: string
  courses: TakenCourse[]
  /** True when the report's Course History section was found. Otherwise every course line was used. */
  fromCourseHistory: boolean
}

// "25FA    CS 1114     3.0    AP   >D   Introduction Software Design"
const COURSE_LINE =
  /^\s*(\d{2}(?:FA|SP|SU|WI))\s+([A-Z]{2,5})\s+([0-9][0-9X*]{3}[A-Z]?)\s+(\d+\.\d+)\s+([A-Z][A-Z+-]?|AP|TR|IP)\s*(?:>[A-Z]\s+)?(.*)$/

/**
 * Reads the text of a VT DARS "Audit Results" report and returns the student's courses.
 * Only course facts are kept. The student's name and ID are never read.
 */
export function parseDars(text: string): DarsImport {
  const lines = text.split(/\r?\n/)

  const header = lines.slice(0, 40).join('\n')
  const programCode = header.match(/Program\s+(?:Code\s+)?([A-Z]{2,6} [A-Z]{2,6})\b/)?.[1]
  const catalogYear = header.match(/Catalog Year\s+((?:Fall|Spring|Summer|Winter) \d{4})/)?.[1]
  const degreeTitle = lines
    .slice(0, 10)
    .map((l) => l.trim())
    .find((l) => /^(BACHELOR|MASTER) OF /.test(l))

  // Every course appears in Course History once, so prefer that section when it's there.
  const start = lines.findIndex((l) => /^\s*Course History\s*$/.test(l))
  const end = lines.findIndex((l, i) => i > start && /CREDIT SUMMARY|END OF ANALYSIS/.test(l))
  const body = start >= 0 ? lines.slice(start, end > start ? end : undefined) : lines

  const seen = new Set<string>()
  const courses: TakenCourse[] = []
  for (const line of body) {
    const m = line.match(COURSE_LINE)
    if (!m) continue
    const [, term, subj, num, credits, grade, title] = m
    const code = normalizeCode(`${subj} ${num}`)
    const key = `${term}|${code}`
    if (seen.has(key)) continue
    seen.add(key)
    courses.push({ term, code, credits: Number(credits), grade, title: title.trim() || undefined })
  }

  return { programCode, degreeTitle, catalogYear, courses, fromCourseHistory: start >= 0 }
}
