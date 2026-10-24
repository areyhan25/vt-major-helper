import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { courseInfo, programs } from '../data'
import { autoPlan, coursesToPlan, parseCredits, type PlanCatalogEntry } from './autoplan'
import { PLANNED } from './grades'
import { checkPlanned } from './prereqs'
import { termOrder } from './terms'
import type { TakenCourse } from './types'

function catalogFor(codes: string[]): Record<string, PlanCatalogEntry> {
  const out: Record<string, PlanCatalogEntry> = {}
  for (const subj of new Set(codes.map((c) => c.split(' ')[0]))) {
    const file = JSON.parse(readFileSync(`src/data/catalog/${subj.toLowerCase()}.json`, 'utf8'))
    for (const c of codes) if (file.courses[c]) out[c] = file.courses[c]
  }
  return out
}

const program = (id: string) => programs.find((p) => p.id === id)!

function plan(id: string, courses: TakenCourse[], planned: TakenCourse[] = [], maxCredits = 16) {
  const codes = coursesToPlan(program(id), courses, planned, courseInfo)
  return autoPlan({ program: program(id), courses, planned, info: courseInfo, catalog: catalogFor(codes), maxCredits })
}

const credits = (cs: TakenCourse[], term: string) => cs.filter((c) => c.term === term).reduce((n, c) => n + c.credits, 0)

describe('parseCredits', () => {
  it('reads fixed and variable credits', () => {
    expect(parseCredits('4 credits')).toBe(4)
    expect(parseCredits('1-19 credits')).toBe(3)
    expect(parseCredits('1 credit')).toBe(1)
    expect(parseCredits(undefined)).toBe(3)
  })
})

describe('autoPlan', () => {
  for (const id of ['cs-bs-2025', 'cpe-bs-2025', 'ee-bs-2025', 'me-bs-2025']) {
    it(`plans a whole ${id} degree in prerequisite order within the credit limit`, () => {
      const courses: TakenCourse[] = [{ term: '25FA', code: 'MATH 1225', credits: 4, grade: 'A' }]
      const result = plan(id, courses)
      const terms = [...new Set(result.planned.map((c) => c.term))]
      expect(terms.every((t) => termOrder(t) > termOrder('25FA') && !t.endsWith('SU'))).toBe(true)
      for (const t of terms) expect(credits(result.planned, t)).toBeLessThanOrEqual(16)
      expect(result.unscheduled).toEqual([])

      const all = [...courses, ...result.planned]
      const total = all.reduce((n, c) => n + c.credits, 0)
      expect(total).toBeGreaterThanOrEqual(program(id).totalCredits)

      // Every prerequisite the plan can meet is met.
      const codes = result.planned.filter((c) => !c.autoPlan?.slot).map((c) => c.code)
      const catalog = catalogFor(codes)
      const warned = result.planned.filter((c) => !c.autoPlan?.slot && checkPlanned(c, all, catalog[c.code])?.prereq.length)
      for (const c of warned) {
        // Only prerequisites outside the plan (like an elective) may be missing.
        const missing = checkPlanned(c, all, catalog[c.code])!.prereq.join(' ')
        expect(codes.some((code) => missing === code)).toBe(false)
      }
    })
  }

  it('flags elective requirements as slots instead of guessing a course', () => {
    const result = plan('cs-bs-2025', [])
    const slots = result.planned.filter((c) => c.autoPlan?.slot)
    expect(slots.map((s) => s.autoPlan!.slot)).toContain('CS Theory Elective')
    expect(slots.find((s) => s.autoPlan!.slot === 'CS Theory Elective')!.autoPlan!.options).toContain('CS 4104')
    expect(slots.some((s) => s.autoPlan!.slot === 'Free elective')).toBe(true)
  })

  it('takes the first option of an either/or and says so', () => {
    const result = plan('cs-bs-2025', [])
    expect(result.picks).toContainEqual({ label: 'Multivariable Calculus', picked: ['MATH 2204'], others: ['CMDA 2005'] })
    expect(result.planned.find((c) => c.code === 'MATH 2204')!.autoPlan!.alts).toEqual(['CMDA 2005'])
  })

  it('puts a course after its prerequisite', () => {
    const result = plan('cs-bs-2025', [])
    const at = (code: string) => termOrder(result.planned.find((c) => c.code === code)!.term)
    expect(at('CS 2114')).toBeGreaterThan(at('CS 1114'))
    expect(at('CS 3114')).toBeGreaterThan(at('CS 2114'))
  })

  it('puts an elective slot first when a required course needs one of its options', () => {
    const result = plan('cs-bs-2025', [])
    const at = (c?: TakenCourse) => termOrder(c!.term)
    const comm = result.planned.find((c) => c.autoPlan?.slot === 'Communications Elective')
    expect(at(result.planned.find((c) => c.code === 'CS 3604'))).toBeGreaterThan(at(comm))
  })

  it('keeps hand-planned courses and skips what they cover', () => {
    const planned: TakenCourse[] = [{ term: '26SP', code: 'CS 1114', credits: 3, grade: PLANNED }]
    const result = plan('cs-bs-2025', [{ term: '25FA', code: 'MATH 1225', credits: 4, grade: 'A' }], planned)
    expect(result.planned.some((c) => c.code === 'CS 1114')).toBe(false)
    expect(credits([...planned, ...result.planned], '26SP')).toBeLessThanOrEqual(16)
  })

  it('respects a lower credit limit', () => {
    const result = plan('me-bs-2025', [], [], 13)
    for (const t of new Set(result.planned.map((c) => c.term))) expect(credits(result.planned, t)).toBeLessThanOrEqual(13)
  })
})
