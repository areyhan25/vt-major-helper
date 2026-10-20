import { ProgramSchema, type CourseInfo, type Program } from '../engine/types'
import coursesJson from './courses.json'
import cpeBs2025 from './programs/cpe-bs-2025.json'
import csBs2025 from './programs/cs-bs-2025.json'
import eeBs2025 from './programs/ee-bs-2025.json'
import meBs2025 from './programs/me-bs-2025.json'

export const programs: Program[] = [csBs2025, cpeBs2025, eeBs2025, meBs2025].map((p) => ProgramSchema.parse(p))

/** Majors planned for v1 that don't have requirement files yet. */
export const comingSoon: string[] = []

export const courseInfo: CourseInfo = coursesJson.courses

/** Finds the program a DARS report is for, by its program code. */
export function programForDars(code: string | undefined): Program | undefined {
  if (!code) return undefined
  return programs.find((p) => p.darsCodes.includes(code))
}
