import { countsForCredit, isInProgress, meetsMinGrade } from './grades'
import { matchesAny, matchesPattern } from './match'
import { termOrder } from './terms'
import type { CourseInfo, Program, Rule, Section, TakenCourse } from './types'

export type Status = 'done' | 'in-progress' | 'needed'

export interface RuleResult {
  rule: Rule
  status: Status
  /** Courses this rule used. */
  used: TakenCourse[]
  /** For credit rules: credits done (excluding in progress) and needed. */
  earned?: number
  inProgress?: number
  required?: number
  /** Why a matching course didn't count, e.g. a grade below the minimum. */
  note?: string
  children?: RuleResult[]
}

export interface SectionResult {
  section: Section
  result: RuleResult
}

export interface AuditResult {
  program: Program
  sections: SectionResult[]
  totalCredits: { earned: number; inProgress: number; required: number }
  /** Courses no section used. They count toward total credits as free electives. */
  unused: TakenCourse[]
  status: Status
}

const keyOf = (c: TakenCourse) => `${c.term}|${c.code}`

interface Ctx {
  courses: TakenCourse[]
  info: CourseInfo
  /** Can this section still use the course? */
  available: (c: TakenCourse) => boolean
}

/** Completed courses first, so an in-progress course is only used when needed. */
function byCompletion(a: TakenCourse, b: TakenCourse) {
  return Number(isInProgress(a.grade)) - Number(isInProgress(b.grade))
}

function evalRule(rule: Rule, ctx: Ctx, claimed: Set<string>): RuleResult {
  const free = (c: TakenCourse) => ctx.available(c) && !claimed.has(keyOf(c)) && countsForCredit(c.grade)

  switch (rule.type) {
    case 'course': {
      const matches = ctx.courses.filter((c) => matchesPattern(c.code, rule.course) && free(c)).sort(byCompletion)
      const ok = matches.find((c) => meetsMinGrade(c.grade, rule.minGrade))
      if (!ok) {
        const low = matches[0]
        return {
          rule,
          status: 'needed',
          used: [],
          note: low ? `${low.code} grade ${low.grade} is below the ${rule.minGrade} minimum` : undefined,
        }
      }
      claimed.add(keyOf(ok))
      return { rule, status: isInProgress(ok.grade) ? 'in-progress' : 'done', used: [ok] }
    }

    case 'credits': {
      const pathwaysOf = (c: TakenCourse) => ctx.info[c.code]?.pathways ?? []
      const candidates = ctx.courses
        .filter(
          (c) =>
            free(c) &&
            c.credits > 0 &&
            (!rule.from || matchesAny(c.code, rule.from)) &&
            !matchesAny(c.code, rule.exclude) &&
            (!rule.pathways || pathwaysOf(c).some((p) => rule.pathways!.includes(p))) &&
            meetsMinGrade(c.grade, rule.minGrade),
        )
        .sort(byCompletion)
      const used: TakenCourse[] = []
      let earned = 0
      let inProgress = 0
      const minCourses = rule.courses ?? 0
      for (const c of candidates) {
        if (earned + inProgress >= rule.credits && used.length >= minCourses) break
        used.push(c)
        claimed.add(keyOf(c))
        if (isInProgress(c.grade)) inProgress += c.credits
        else earned += c.credits
      }
      const doneCourses = used.filter((c) => !isInProgress(c.grade)).length
      const status: Status =
        earned >= rule.credits && doneCourses >= minCourses
          ? 'done'
          : earned + inProgress >= rule.credits && used.length >= minCourses
            ? 'in-progress'
            : 'needed'
      return { rule, status, used, earned, inProgress, required: rule.credits }
    }

    case 'allOf': {
      const children = rule.rules.map((r) => evalRule(r, ctx, claimed))
      return { rule, status: combineAll(children), used: children.flatMap((c) => c.used), children }
    }

    case 'anyOf': {
      // Try each option on a scratch copy and keep the one that gets furthest.
      let best: { result: RuleResult; claims: Set<string> } | undefined
      for (const r of rule.rules) {
        const claims = new Set(claimed)
        const result = evalRule(r, ctx, claims)
        if (!best || score(result) > score(best.result)) best = { result, claims }
        if (result.status === 'done') break
      }
      if (!best) return { rule, status: 'needed', used: [], children: [] }
      for (const k of best.claims) claimed.add(k)
      return { rule, status: best.result.status, used: best.result.used, children: [best.result] }
    }
  }
}

function combineAll(children: RuleResult[]): Status {
  if (children.every((c) => c.status === 'done')) return 'done'
  if (children.every((c) => c.status !== 'needed')) return 'in-progress'
  return 'needed'
}

/** How far along a result is, for picking between anyOf options. */
function score(r: RuleResult): number {
  const base = r.status === 'done' ? 2 : r.status === 'in-progress' ? 1 : 0
  return base + Math.min(r.used.length, 99) / 100
}

export function runAudit(program: Program, courses: TakenCourse[], info: CourseInfo = {}): AuditResult {
  // Per course: the buckets it's been used in, or "all" once an exclusive section takes it.
  const usage = new Map<string, Set<string> | 'all'>()

  const order = program.sections
    .map((section, i) => ({ section, i }))
    .sort((a, b) => (a.section.priority ?? 0) - (b.section.priority ?? 0) || a.i - b.i)

  const counted = dedupeForCredit(courses)
  const results = new Map<string, RuleResult>()
  for (const { section } of order) {
    const available = (c: TakenCourse) => {
      const u = usage.get(keyOf(c))
      if (!u) return true
      if (u === 'all' || section.exclusive) return false
      return !u.has(section.bucket)
    }
    const claimed = new Set<string>()
    const result = evalRule(section.rule, { courses: counted, info, available }, claimed)
    for (const k of claimed) {
      const u = usage.get(k)
      if (section.exclusive) usage.set(k, 'all')
      else if (u !== 'all') usage.set(k, new Set([...(u ?? []), section.bucket]))
    }
    results.set(section.id, result)
  }

  const sections = program.sections.map((section) => ({ section, result: results.get(section.id)! }))

  const earned = sum(counted.filter((c) => !isInProgress(c.grade)))
  const inProgress = sum(counted.filter((c) => isInProgress(c.grade)))
  const unused = counted.filter((c) => !usage.has(keyOf(c)))

  const creditStatus: Status =
    earned >= program.totalCredits ? 'done' : earned + inProgress >= program.totalCredits ? 'in-progress' : 'needed'
  const status = combineAll([...sections.map((s) => s.result), { status: creditStatus } as RuleResult])

  return {
    program,
    sections,
    totalCredits: { earned, inProgress, required: program.totalCredits },
    unused,
    status,
  }
}

/** A repeated course only earns credit once; keep the latest attempt that counts. */
function dedupeForCredit(courses: TakenCourse[]): TakenCourse[] {
  const best = new Map<string, TakenCourse>()
  for (const c of courses) {
    if (!countsForCredit(c.grade)) continue
    // Generic transfer credit like "MATH 1XXX" can legitimately appear more than once.
    const key = /X/.test(c.code) ? keyOf(c) : c.code
    const prev = best.get(key)
    if (!prev || termOrder(c.term) >= termOrder(prev.term)) best.set(key, c)
  }
  return [...best.values()]
}

const sum = (cs: TakenCourse[]) => cs.reduce((n, c) => n + c.credits, 0)
