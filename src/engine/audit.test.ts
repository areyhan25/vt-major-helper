import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { courseInfo, programs } from '../data'
import { parseDars } from '../import/dars'
import { runAudit, termOrder } from './audit'
import { meetsMinGrade } from './grades'
import { matchesPattern } from './match'
import type { Program, TakenCourse } from './types'

const c = (code: string, grade = 'A', credits = 3, term = '25FA'): TakenCourse => ({ code, grade, credits, term })

function program(sections: Program['sections'], totalCredits = 10): Program {
  return { id: 't', name: 'Test', catalogYear: '2025-2026', darsCodes: [], totalCredits, source: 'https://example.com', notes: [], sections }
}

describe('helpers', () => {
  it('matches wildcard patterns', () => {
    expect(matchesPattern('CS 4104', 'CS 4***')).toBe(true)
    expect(matchesPattern('CS 3114', 'CS 4***')).toBe(false)
    expect(matchesPattern('ECE 4984A', 'ECE 4***')).toBe(true)
    expect(matchesPattern('CSE 4104', 'CS 4***')).toBe(false)
  })

  it('compares grades', () => {
    expect(meetsMinGrade('C', 'C')).toBe(true)
    expect(meetsMinGrade('C-', 'C')).toBe(false)
    expect(meetsMinGrade('AP', 'C')).toBe(true)
    expect(meetsMinGrade('IP', 'C')).toBe(true)
    expect(meetsMinGrade('F')).toBe(false)
    expect(meetsMinGrade('W')).toBe(false)
  })

  it('orders terms by calendar', () => {
    expect(termOrder('26SP')).toBeLessThan(termOrder('26SU'))
    expect(termOrder('26SU')).toBeLessThan(termOrder('26FA'))
    expect(termOrder('25FA')).toBeLessThan(termOrder('26SP'))
  })
})

describe('runAudit', () => {
  it('marks a course requirement done, in progress, or needed', () => {
    const p = program([
      { id: 'a', title: 'A', bucket: 'major', rule: { type: 'course', course: 'CS 1114' } },
      { id: 'b', title: 'B', bucket: 'major', rule: { type: 'course', course: 'CS 2114' } },
      { id: 'c', title: 'C', bucket: 'major', rule: { type: 'course', course: 'CS 2505' } },
    ])
    const r = runAudit(p, [c('CS 1114'), c('CS 2114', 'IP')])
    expect(r.sections.map((s) => s.result.status)).toEqual(['done', 'in-progress', 'needed'])
  })

  it('explains a grade below the minimum', () => {
    const p = program([{ id: 'a', title: 'A', bucket: 'major', rule: { type: 'course', course: 'CS 2114', minGrade: 'C' } }])
    const r = runAudit(p, [c('CS 2114', 'C-')])
    expect(r.sections[0].result.status).toBe('needed')
    expect(r.sections[0].result.note).toMatch(/below the C minimum/)
  })

  it('uses a course once within a bucket but lets Pathways double count', () => {
    const p = program([
      { id: 'core', title: 'Core', bucket: 'major', rule: { type: 'course', course: 'CS 3114' } },
      { id: 'elec', title: 'Elective', bucket: 'major', rule: { type: 'credits', credits: 3, from: ['CS 3***'] } },
      { id: 'pw', title: 'Pathways 5', bucket: 'pathways', rule: { type: 'credits', credits: 3, pathways: ['5a'] } },
    ])
    const r = runAudit(p, [c('CS 3114')], { 'CS 3114': { pathways: ['5a'] } })
    expect(r.sections.map((s) => s.result.status)).toEqual(['done', 'needed', 'done'])
  })

  it('keeps courses in an exclusive section out of Pathways', () => {
    const p = program([
      { id: 'core', title: 'Core', bucket: 'major', exclusive: true, rule: { type: 'course', course: 'MATH 2114' } },
      { id: 'pw', title: 'Pathways 5', bucket: 'pathways', rule: { type: 'credits', credits: 3, pathways: ['5a'] } },
    ])
    const r = runAudit(p, [c('MATH 2114')], { 'MATH 2114': { pathways: ['5a'] } })
    expect(r.sections[1].result.status).toBe('needed')
  })

  it('runs specific sections before broad electives using priority', () => {
    const p = program([
      { id: 'elec', title: 'Elective', bucket: 'major', priority: 2, rule: { type: 'credits', credits: 3, from: ['CS 4***'] } },
      { id: 'cap', title: 'Capstone', bucket: 'major', priority: 1, rule: { type: 'credits', credits: 3, from: ['CS 4624'] } },
    ])
    const r = runAudit(p, [c('CS 4624')])
    expect(r.sections.map((s) => s.section.id)).toEqual(['elec', 'cap'])
    expect(r.sections.map((s) => s.result.status)).toEqual(['needed', 'done'])
  })

  it('applies exclusions and minimum course counts in credit rules', () => {
    const rule = { type: 'credits' as const, credits: 6, courses: 2, from: ['CS 3***'], exclude: ['CS 3114'] }
    const p = program([{ id: 'e', title: 'E', bucket: 'major', rule }])
    expect(runAudit(p, [c('CS 3114'), c('CS 3214', 'A', 6)]).sections[0].result.status).toBe('needed')
    expect(runAudit(p, [c('CS 3214'), c('CS 3304')]).sections[0].result.status).toBe('done')
  })

  it('picks the anyOf option that is furthest along', () => {
    const p = program([
      {
        id: 'f', title: 'F', bucket: 'major',
        rule: {
          type: 'anyOf',
          rules: [
            { type: 'allOf', rules: [{ type: 'course', course: 'ENGE 1215' }, { type: 'course', course: 'ENGE 1216' }] },
            { type: 'course', course: 'ENGE 1414' },
          ],
        },
      },
    ])
    expect(runAudit(p, [c('ENGE 1414')]).sections[0].result.status).toBe('done')
    expect(runAudit(p, [c('ENGE 1215'), c('ENGE 1216', 'IP')]).sections[0].result.status).toBe('in-progress')
  })

  it('counts a repeated course once, using the latest attempt', () => {
    const p = program([{ id: 'a', title: 'A', bucket: 'major', rule: { type: 'course', course: 'CS 2114', minGrade: 'C' } }])
    const r = runAudit(p, [c('CS 2114', 'D', 3, '25FA'), c('CS 2114', 'B', 3, '26SP')])
    expect(r.sections[0].result.status).toBe('done')
    expect(r.totalCredits.earned).toBe(3)
  })

  it('totals credits and lists unused courses as free electives', () => {
    const p = program([{ id: 'a', title: 'A', bucket: 'major', rule: { type: 'course', course: 'CS 1114' } }])
    const r = runAudit(p, [c('CS 1114'), c('ARCH 2004'), c('CS 2506', 'IP'), c('MATH 1XXX', 'TR', 1, '26SU'), c('PHYS 2305', 'F')])
    expect(r.totalCredits).toEqual({ earned: 7, inProgress: 3, required: 10 })
    expect(r.unused.map((x) => x.code)).toEqual(['ARCH 2004', 'CS 2506', 'MATH 1XXX'])
  })
})

describe('CS B.S. 2025-26 with the sample DARS', () => {
  const cs = programs.find((p) => p.id === 'cs-bs-2025')!
  const { courses } = parseDars(readFileSync(new URL('../import/fixtures/sample-dars.txt', import.meta.url), 'utf8'))
  const audit = runAudit(cs, courses, courseInfo)
  const status = (id: string) => audit.sections.find((s) => s.section.id === id)!.result.status

  it('totals credits like DARS does', () => {
    expect(audit.totalCredits).toEqual({ earned: 39, inProgress: 6, required: 123 })
  })

  it('flags CS 2114 below a C', () => {
    const additional = audit.sections.find((s) => s.section.id === 'additional')!.result
    expect(additional.children![0].note).toMatch(/CS 2114 grade C- is below the C minimum/)
  })

  it('shows sections in the right state', () => {
    expect(status('degree-core')).toBe('needed')
    expect(status('pathways-major')).toBe('in-progress')
    expect(status('pathways-4')).toBe('done')
    expect(status('pathways-2')).toBe('needed')
  })
})
