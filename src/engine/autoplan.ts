import { runAudit, type RuleResult } from './audit'
import { countsForCredit, PLANNED } from './grades'
import { parsePrereq, unmetParts, type Prereq } from './prereqs'
import { termOrder, termsAfter } from './terms'
import type { CourseInfo, Program, Rule, TakenCourse } from './types'

/** What auto-plan needs to know about a course from the catalog. */
export interface PlanCatalogEntry {
  title?: string
  /** "3 credits", "1-19 credits" */
  credits?: string
  prereq?: string
  coreq?: string
}

export interface AutoPlanInput {
  program: Program
  /** The real record: finished and in-progress courses. */
  courses: TakenCourse[]
  /** Courses the student planned by hand. They stay where they are. */
  planned: TakenCourse[]
  info: CourseInfo
  catalog: Record<string, PlanCatalogEntry>
  /** Most credits to put in one semester. */
  maxCredits: number
}

/** An "A or B" requirement where auto-plan took the first option. */
export interface Pick {
  label: string
  picked: string[]
  others: string[]
}

export interface AutoPlanResult {
  /** The new planned courses, each marked with `autoPlan`. */
  planned: TakenCourse[]
  picks: Pick[]
  /** Courses that didn't fit in the semesters auto-plan is willing to add. */
  unscheduled: string[]
}

/** How many semesters auto-plan will add at most. */
export const MAX_TERMS = 12

const isConcrete = (code: string) => !code.includes('*')

/** "3 credits" -> 3. A variable range like "1-19 credits" assumes 3 when it can. */
export function parseCredits(text: string | undefined): number {
  const m = text?.match(/^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/)
  if (!m) return 3
  const lo = Number(m[1])
  const hi = m[2] ? Number(m[2]) : lo
  return lo <= 3 && 3 <= hi ? 3 : lo
}

/** "CS 4***" -> 4, the course level a pattern starts at. */
const levelOf = (code: string) => Number(code.split(' ')[1]?.[0]) || 1

/** The specific courses a rule asks for, or undefined when it leaves a choice (credits, patterns). */
function concreteCodes(rule: Rule): string[] | undefined {
  if (rule.type === 'course') return isConcrete(rule.course) ? [rule.course] : undefined
  if (rule.type === 'allOf') {
    const parts = rule.rules.map(concreteCodes)
    return parts.includes(undefined) ? undefined : (parts as string[][]).flat()
  }
  if (rule.type === 'anyOf') return rule.rules[0] ? concreteCodes(rule.rules[0]) : undefined
  return undefined
}

function describe(rule: Rule): string {
  if (rule.label) return rule.label
  if (rule.type === 'course') return rule.course
  if (rule.type === 'credits') return `${rule.credits} credits`
  return rule.rules.map(describe).join(rule.type === 'anyOf' ? ' or ' : ' and ')
}

/**
 * The specific courses still needed, from an audit. An "A or B" with no progress takes its first
 * option, which is how the catalog lists the usual route, and records the pick so the student can swap.
 */
function collectCourses(result: RuleResult, out: Set<string>, picks: Pick[]) {
  if (result.status !== 'needed') return
  const { rule } = result
  if (rule.type === 'course') {
    if (isConcrete(rule.course)) out.add(rule.course)
  } else if (rule.type === 'allOf') {
    result.children!.forEach((c) => collectCourses(c, out, picks))
  } else if (rule.type === 'anyOf') {
    const best = result.children?.[0]
    if (best && best.used.length > 0) return collectCourses(best, out, picks)
    const first = rule.rules[0] && concreteCodes(rule.rules[0])
    if (!first) return
    first.forEach((c) => out.add(c))
    picks.push({ label: describe(rule), picked: first, others: rule.rules.slice(1).map(describe) })
  }
}

interface Slot {
  label: string
  credits: number
  options?: string[]
  /** Pathways tags any course in the slot needs. */
  pathways?: string[]
  level: number
}

/** Placeholder slots for requirements that leave the student a choice of course. */
function collectSlots(result: RuleResult, label: string, out: Slot[]) {
  if (result.status !== 'needed') return
  const { rule } = result
  if (rule.type === 'course') {
    if (!isConcrete(rule.course))
      out.push({ label: rule.label ?? rule.course, credits: 3, options: [rule.course], level: levelOf(rule.course) })
  } else if (rule.type === 'allOf') {
    result.children!.forEach((c) => collectSlots(c, label, out))
  } else if (rule.type === 'anyOf') {
    const best = result.children?.[0]
    if (best && best.used.length > 0) return collectSlots(best, label, out)
    const options = rule.rules.flatMap((r) => (r.type === 'credits' ? (r.from ?? []) : r.type === 'course' ? [r.course] : []))
    const credits = Math.min(...rule.rules.map((r) => (r.type === 'credits' ? r.credits : 3)))
    out.push({
      label: rule.label ?? label,
      credits,
      options,
      level: options.length ? Math.min(...options.map(levelOf)) : 1,
    })
  } else {
    const left = (result.required ?? 0) - (result.earned ?? 0) - (result.inProgress ?? 0)
    const coursesLeft = Math.max(0, (rule.courses ?? 0) - result.used.length)
    // 3-credit slots, unless the credits split better into 4s (like 8 credits of lab science).
    const count = Math.max(left <= 0 ? 0 : left <= 4 ? 1 : left % 3 === 0 ? left / 3 : Math.ceil(left / 4), coursesLeft)
    if (count <= 0) return
    const name = rule.label ?? label
    for (let i = 0; i < count; i++) {
      // Spread the credits evenly, larger slots first.
      const credits = left > 0 ? Math.floor(left / count) + (i < left % count ? 1 : 0) || 1 : 3
      out.push({
        label: rule.pathways && rule.label ? `Pathways ${name}` : name,
        credits,
        options: rule.from,
        pathways: rule.pathways,
        level: rule.from?.length ? Math.min(...rule.from.map(levelOf)) : 1,
      })
    }
  }
}

/** Codes auto-plan will want catalog entries for, so they can be loaded first. */
export function coursesToPlan(program: Program, courses: TakenCourse[], planned: TakenCourse[], info: CourseInfo) {
  const audit = runAudit(program, [...courses, ...planned], info)
  const codes = new Set<string>()
  audit.sections.forEach((s) => collectCourses(s.result, codes, []))
  return [...codes]
}

/** Fall and Spring semesters after `term`. Summers are left for the student to add. */
function regularTermsAfter(term: string, count: number): string[] {
  return termsAfter(term, count * 2).filter((t) => !t.endsWith('SU')).slice(0, count)
}

const codesIn = (p: Prereq | undefined): string[] => (!p ? [] : 'code' in p ? [p.code] : p.parts.flatMap(codesIn))

interface Item {
  code: string
  credits: number
  title?: string
  level: number
  slot?: Slot
  pre?: Prereq
  co?: Prereq
  alts?: string[]
  term?: string
}

/**
 * Fills the semesters after the student's last real one with the courses they still need.
 * Courses go in prerequisite order, longest chains first, up to `maxCredits` a semester.
 * Requirements that leave a choice get placeholder slots for the student to fill in.
 */
export function autoPlan({ program, courses, planned, info, catalog, maxCredits }: AutoPlanInput): AutoPlanResult {
  const before = [...courses, ...planned]
  const picks: Pick[] = []
  const needed = new Set<string>()
  runAudit(program, before, info).sections.forEach((s) => collectCourses(s.result, needed, picks))

  const altsFor = new Map(picks.flatMap((p) => p.picked.map((c) => [c, p.others] as const)))
  const required: Item[] = [...needed].map((code) => {
    const entry = catalog[code]
    return {
      code,
      credits: parseCredits(entry?.credits),
      title: entry?.title,
      level: levelOf(code),
      pre: entry?.prereq ? parsePrereq(entry.prereq) : undefined,
      co: entry?.coreq ? parsePrereq(entry.coreq) : undefined,
      alts: altsFor.get(code),
    }
  })

  // Audit again with the required courses in, so slots only cover what they don't.
  const asPlanned = (i: Item): TakenCourse => ({ term: '', code: i.code, credits: i.credits, grade: PLANNED })
  const withRequired = runAudit(program, [...before, ...required.map(asPlanned)], info)
  const slots: Slot[] = []
  withRequired.sections.forEach((s) => collectSlots(s.result, s.section.title, slots))
  dropCoveredPathways(slots, info)
  const slotCredits = slots.reduce((n, s) => n + s.credits, 0)
  const { earned, inProgress, required: total } = withRequired.totalCredits
  for (let left = total - earned - inProgress - slotCredits; left > 0; left -= 3)
    slots.push({ label: 'Free elective', credits: Math.min(3, left), level: 1 })

  const items: Item[] = [
    ...required,
    ...slots.map((slot, i) => ({ code: `SLOT ${i + 1}`, credits: slot.credits, level: slot.level, slot })),
  ]
  schedule(items, courses, planned, maxCredits)

  return {
    planned: items
      .filter((i) => i.term)
      .map((i) => ({
        term: i.term!,
        code: i.code,
        credits: i.credits,
        grade: PLANNED,
        ...(i.title ? { title: i.title } : {}),
        autoPlan: {
          ...(i.slot ? { slot: i.slot.label, options: i.slot.options?.slice(0, 12) } : {}),
          ...(i.alts?.length ? { alts: i.alts } : {}),
        },
      })),
    picks,
    unscheduled: items.filter((i) => !i.term).map((i) => i.slot?.label ?? i.code),
  }
}

/**
 * A Pathways slot is dropped when another slot's courses carry its tag, since the course picked
 * there double counts (like a Natural Science pick also covering Pathways 4).
 */
function dropCoveredPathways(slots: Slot[], info: CourseInfo) {
  // Credits of each major slot not yet counted toward a Pathways slot.
  const spare = new Map(slots.filter((o) => !o.pathways).map((o) => [o, o.credits]))
  for (const s of slots.filter((s) => s.pathways)) {
    for (const [o, credits] of spare) {
      if (s.credits <= 0) break
      // Most of its options, since labs often carry no tag of their own.
      const tagged = o.options?.filter((c) => info[c]?.pathways?.some((p) => s.pathways!.includes(p))).length ?? 0
      if (!credits || tagged * 2 <= o.options!.length) continue
      const used = Math.min(credits, s.credits)
      spare.set(o, credits - used)
      s.credits -= used
    }
  }
  for (let i = slots.length - 1; i >= 0; i--) if (slots[i].credits <= 0) slots.splice(i, 1)
}

function schedule(items: Item[], courses: TakenCourse[], planned: TakenCourse[], maxCredits: number) {
  const lastReal = courses.map((c) => c.term).sort((a, b) => termOrder(a) - termOrder(b)).at(-1) ?? ''
  const terms = regularTermsAfter(lastReal, MAX_TERMS)
  const load = new Map<string, number>()
  for (const p of planned) load.set(p.term, (load.get(p.term) ?? 0) + p.credits)

  const real = courses.filter((c) => countsForCredit(c.grade)).map((c) => c.code)
  const required = items.filter((i) => !i.slot)
  const requiredCodes = new Set(required.map((i) => i.code))
  // What taking an item gives you. A slot gives any of its options, so it can meet a prerequisite.
  const provides = (i: Item) =>
    i.slot ? (i.slot.options ?? []).filter((c) => isConcrete(c) && !requiredCodes.has(c)) : [i.code]
  const needs = (i: Item) => [...codesIn(i.pre), ...codesIn(i.co)]
  const unlocks = (i: Item) => required.filter((r) => provides(i).some((c) => needs(r).includes(c)))
  // Slots a required course depends on, like a Communications Elective before CS 3604, go in with
  // the required courses instead of waiting for leftover room.
  const ordered = [...required, ...items.filter((i) => i.slot && unlocks(i).length)]
  const eventually = new Set([...real, ...planned.map((p) => p.code), ...ordered.flatMap(provides)])
  // Requirements that can't be met even with the whole plan are left for the warnings to point out.
  const canMeet = (p: Prereq | undefined) => !!p && unmetParts(p, (c) => eventually.has(c)).length === 0
  const hasBy = (term: string, sameTermOk: boolean) => {
    const at = termOrder(term)
    const done = new Set(real)
    const placed = ordered.filter((i) => i.term).flatMap((i) => provides(i).map((code) => ({ code, term: i.term! })))
    for (const p of [...planned, ...placed]) {
      const t = termOrder(p.term)
      if (t < at || (sameTermOk && t === at)) done.add(p.code)
    }
    return (code: string) => done.has(code)
  }
  // Class standing, roughly: 3000-level courses after 30 credits and 4000-level after 60, since
  // prerequisites like "Junior standing" can't be parsed.
  const creditsBefore = (term: string) => {
    const at = termOrder(term)
    const earlier = [...planned, ...items.filter((i) => i.term)].filter((p) => termOrder(p.term!) < at)
    return [...courses.filter((c) => countsForCredit(c.grade)), ...earlier].reduce((n, c) => n + c.credits, 0)
  }
  const standing = (i: Item, term: string) => creditsBefore(term) >= (i.level >= 4 ? 60 : i.level === 3 ? 30 : 0)
  const ready = (i: Item, term: string) =>
    standing(i, term) && (!canMeet(i.pre) || unmetParts(i.pre!, hasBy(term, false)).length === 0)
  const coreqOk = (i: Item, term: string) => !canMeet(i.co) || unmetParts(i.co!, hasBy(term, true)).length === 0

  // Courses that unlock long chains go first.
  const depth = new Map<Item, number>()
  const depthOf = (i: Item, seen = new Set<Item>()): number => {
    if (depth.has(i)) return depth.get(i)!
    if (seen.has(i)) return 0
    seen.add(i)
    const d = 1 + Math.max(0, ...unlocks(i).map((r) => depthOf(r, seen)))
    depth.set(i, d)
    return d
  }
  ordered.sort((a, b) => depthOf(b) - depthOf(a) || a.level - b.level || a.code.localeCompare(b.code))
  const slots = items.filter((i) => i.slot && !ordered.includes(i)).sort((a, b) => a.level - b.level)

  const totalCredits = items.reduce((n, i) => n + i.credits, 0)
  const spread = Math.max(1, Math.ceil(totalCredits / maxCredits))
  // Even out the load over the semesters it should take, instead of packing the early ones.
  const target = Math.min(maxCredits, Math.ceil(totalCredits / spread))

  for (let t = 0; t < terms.length && items.some((i) => !i.term); t++) {
    const term = terms[t]
    const cap = (t < spread ? target : maxCredits) - (load.get(term) ?? 0)
    let used = 0
    const fits = (n: number) => used + n <= cap
    const place = (i: Item) => {
      i.term = term
      used += i.credits
    }

    for (let changed = true; changed; ) {
      changed = false
      for (const i of ordered) {
        if (i.term || !fits(i.credits) || !ready(i, term) || !coreqOk(i, term)) continue
        place(i)
        changed = true
      }
      // A course and its corequisite (like a lecture and its lab) go in together.
      for (const i of required) {
        if (i.term || !ready(i, term) || coreqOk(i, term)) continue
        const partners = required.filter((r) => !r.term && r !== i && codesIn(i.co).includes(r.code) && ready(r, term))
        const credits = i.credits + partners.reduce((n, r) => n + r.credits, 0)
        if (!partners.length || !fits(credits)) continue
        ;[i, ...partners].forEach(place)
        if (!coreqOk(i, term)) [i, ...partners].forEach((r) => ((r.term = undefined), (used -= r.credits)))
        else changed = true
      }
    }

    // Upper-level electives wait for the second half of the plan.
    const late = t >= Math.floor(spread / 2) || required.every((i) => i.term)
    for (const s of slots) if (!s.term && fits(s.credits) && (s.level < 3 || late)) place(s)
  }
}
