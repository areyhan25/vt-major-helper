import { countsForCredit, PLANNED } from './grades'
import { termOrder } from './terms'
import type { TakenCourse } from './types'

/** A catalog prerequisite like "(CS 2114 or ECE 3514) and MATH 2534", parsed. */
export type Prereq = { code: string } | { op: 'and' | 'or'; parts: Prereq[] }

const TOKEN = /\(|\)|\band\b|\bor\b|[A-Z]{2,5} \d{4}[A-Z]?/gi

/**
 * Parses a catalog prerequisite. Returns undefined for anything that isn't just course codes joined
 * by "and", "or" and parentheses ("Junior standing", comma lists), so those are never checked.
 * "and" binds tighter than "or", as usual.
 */
export function parsePrereq(text: string): Prereq | undefined {
  const cleaned = text.trim().replace(/\.$/, '')
  if (cleaned.replace(TOKEN, '').trim() !== '') return undefined
  const tokens = cleaned.match(TOKEN)!.map((t) => (/^(and|or)$/i.test(t) ? t.toLowerCase() : t.toUpperCase()))
  let i = 0

  const group = (op: 'and' | 'or', parts: Prereq[]): Prereq => (parts.length === 1 ? parts[0] : { op, parts })
  function or(): Prereq | undefined {
    const parts = [and()]
    while (tokens[i] === 'or') {
      i++
      parts.push(and())
    }
    return parts.includes(undefined) ? undefined : group('or', parts as Prereq[])
  }
  function and(): Prereq | undefined {
    const parts = [atom()]
    while (tokens[i] === 'and') {
      i++
      parts.push(atom())
    }
    return parts.includes(undefined) ? undefined : group('and', parts as Prereq[])
  }
  function atom(): Prereq | undefined {
    const t = tokens[i++]
    if (t === '(') {
      const inner = or()
      return tokens[i++] === ')' ? inner : undefined
    }
    return t && /\d/.test(t) ? { code: t } : undefined
  }

  const result = or()
  return i === tokens.length ? result : undefined
}

function met(p: Prereq, has: (code: string) => boolean): boolean {
  if ('code' in p) return has(p.code)
  return p.op === 'and' ? p.parts.every((q) => met(q, has)) : p.parts.some((q) => met(q, has))
}

function describe(p: Prereq, nested = false): string {
  if ('code' in p) return p.code
  const s = p.parts.map((q) => describe(q, true)).join(` ${p.op} `)
  return nested ? `(${s})` : s
}

/** The parts of a prerequisite that aren't met, as text. Empty when it's met. */
export function unmetParts(p: Prereq, has: (code: string) => boolean): string[] {
  if (met(p, has)) return []
  if ('code' in p || p.op === 'or') return [describe(p)]
  return p.parts.flatMap((q) => unmetParts(q, has))
}

export interface PrereqWarning {
  /** Prerequisites not taken in an earlier semester. */
  prereq: string[]
  /** Corequisites not taken in the same or an earlier semester. */
  coreq: string[]
}

/**
 * Checks a planned course against everything else the student has taken or planned.
 * Finished courses with credit, in-progress courses and other planned courses all count.
 */
export function checkPlanned(
  course: TakenCourse,
  all: TakenCourse[],
  catalog: { prereq?: string; coreq?: string } | undefined,
): PrereqWarning | undefined {
  const at = termOrder(course.term)
  const hasBy = (sameTermOk: boolean) => (code: string) =>
    all.some(
      (c) =>
        c !== course &&
        c.code === code &&
        (c.grade === PLANNED || countsForCredit(c.grade)) &&
        (sameTermOk ? termOrder(c.term) <= at : termOrder(c.term) < at),
    )
  const pre = catalog?.prereq ? parsePrereq(catalog.prereq) : undefined
  const co = catalog?.coreq ? parsePrereq(catalog.coreq) : undefined
  const warning = {
    prereq: pre ? unmetParts(pre, hasBy(false)) : [],
    coreq: co ? unmetParts(co, hasBy(true)) : [],
  }
  return warning.prereq.length || warning.coreq.length ? warning : undefined
}
