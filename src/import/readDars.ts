import { programForDars } from '../data'
import type { Program, TakenCourse } from '../engine/types'
import { parseDars } from './dars'

export type DarsMessage = { tone: 'ok' | 'warn' | 'error'; text: string }

export type DarsResult = { courses: TakenCourse[]; message: DarsMessage } | { error: DarsMessage }

/**
 * Reads a DARS report's text into courses, plus a note on how it went.
 * The major is always the one the student picked. The DARS program code
 * only drives a heads-up when it looks like a different major.
 */
export function readDars(text: string, program: Program): DarsResult {
  const result = parseDars(text)
  if (result.courses.length === 0)
    return { error: { tone: 'error', text: "Couldn't find any courses. Is this a DARS Audit Results report?" } }

  const parts = [`Imported ${result.courses.length} courses.`]
  const darsProgram = programForDars(result.programCode)
  if (darsProgram && darsProgram.id !== program.id) {
    parts.push(`Your DARS looks like it's for ${darsProgram.name}, but you picked ${program.name}. Change the major if that's not right.`)
  } else if (result.programCode && !darsProgram) {
    parts.push(`Your DARS is for ${result.programCode}, which isn't supported yet, so it's audited against ${program.name}.`)
  }
  if (result.catalogYear && !result.catalogYear.endsWith(program.catalogYear.slice(0, 4))) {
    parts.push(`Your catalog year is ${result.catalogYear}, but these requirements are for ${program.catalogYear}.`)
  }
  return { courses: result.courses, message: { tone: parts.length > 1 ? 'warn' : 'ok', text: parts.join(' ') } }
}

/** Reads a saved DARS file (PDF, text, or HTML) in the browser and imports it. Nothing is uploaded. */
export async function readDarsFile(file: File, program: Program): Promise<DarsResult> {
  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const { pdfToText } = await import('../import/pdf')
      return readDars(await pdfToText(await file.arrayBuffer()), program)
    }
    return readDars(await file.text(), program)
  } catch (e) {
    return { error: { tone: 'error', text: `Couldn't read that file: ${(e as Error).message}` } }
  }
}

export const DARS_ACCEPT = '.pdf,.txt,.html,application/pdf,text/plain'
