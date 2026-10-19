import { ProgramSchema, type CourseInfo, type Program } from '../engine/types'
import coursesJson from './courses.json'
import csBs2025 from './programs/cs-bs-2025.json'

export const programs: Program[] = [csBs2025].map((p) => ProgramSchema.parse(p))

/** Majors planned for v1 that don't have requirement files yet. */
export const comingSoon = ['Computer Engineering, B.S.', 'Electrical Engineering, B.S.', 'Mechanical Engineering, B.S.']

export const courseInfo: CourseInfo = coursesJson.courses

/** Finds the program a DARS report is for, by its program code. */
export function programForDars(code: string | undefined): Program | undefined {
  if (!code) return undefined
  return programs.find((p) => p.darsCodes.includes(code))
}
