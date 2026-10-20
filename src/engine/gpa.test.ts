import { describe, expect, it } from 'vitest'
import { computeGpa, formatGpa, requiredAverage, termGpas } from './gpa'
import type { TakenCourse } from './types'

const c = (code: string, term: string, grade: string, credits = 3): TakenCourse => ({ code, term, grade, credits })

describe('computeGpa', () => {
  it('weights grade points by credits', () => {
    // (4 x 4.0 + 3 x 3.0) / 7 = 25 / 7
    const g = computeGpa([c('MATH 1225', '25FA', 'A', 4), c('CS 1114', '25FA', 'B')])
    expect(g.hours).toBe(7)
    expect(g.qualityPoints).toBe(25)
    expect(formatGpa(g.gpa)).toBe('3.571')
  })

  it('leaves out pass/fail, AP, transfer, withdrawn and in-progress courses', () => {
    const g = computeGpa([
      c('CS 1114', '25FA', 'A-'),
      c('ENGL 1105', '', 'AP'),
      c('FR 1105', '', 'TR'),
      c('MUS 1104', '25FA', 'P'),
      c('PHYS 2305', '25FA', 'W'),
      c('CS 2114', '26SP', 'IP'),
    ])
    expect(g.hours).toBe(3)
    expect(g.gpa).toBeCloseTo(3.7)
  })

  it('counts an F as hours with no points', () => {
    expect(computeGpa([c('CS 1114', '25FA', 'A'), c('MATH 1226', '25FA', 'F')]).gpa).toBe(2)
  })

  it('counts every attempt of a repeated course', () => {
    expect(computeGpa([c('MATH 1226', '25FA', 'D'), c('MATH 1226', '26SP', 'B')]).gpa).toBe(2)
  })

  it('uses expected grades for in-progress and planned courses', () => {
    const courses = [c('CS 1114', '25FA', 'B'), c('CS 2114', '26SP', 'IP'), c('CS 2505', '26FA', 'PL')]
    expect(computeGpa(courses, { '26SP|CS 2114': 'A' }).gpa).toBe(3.5)
    expect(computeGpa(courses, { '26SP|CS 2114': 'A', '26FA|CS 2505': 'A' }).hours).toBe(9)
  })

  it('has no GPA without letter-graded credit', () => {
    expect(computeGpa([c('ENGL 1105', '', 'AP')]).gpa).toBeUndefined()
  })
})

describe('termGpas', () => {
  it('gives each semester its own GPA and a running cumulative GPA, in calendar order', () => {
    const rows = termGpas([c('CS 2114', '26SP', 'C'), c('CS 1114', '25FA', 'A'), c('ENGL 1105', '', 'AP')])
    expect(rows.map((r) => r.term)).toEqual(['25FA', '26SP'])
    expect(rows.map((r) => r.semester.gpa)).toEqual([4, 2])
    expect(rows.map((r) => r.cumulative.gpa)).toEqual([4, 3])
    expect(rows.every((r) => !r.projected)).toBe(true)
  })

  it('marks semesters that rely on an expected grade', () => {
    const rows = termGpas([c('CS 1114', '25FA', 'A'), c('CS 2114', '26SP', 'IP')], { '26SP|CS 2114': 'B' })
    expect(rows.map((r) => r.projected)).toEqual([false, true])
  })
})

describe('requiredAverage', () => {
  it('finds the average needed over the remaining credits', () => {
    // 30 hours at 3.0 = 90 points. Reaching 3.2 over 60 hours needs 192 points: 102 over 30 hours.
    expect(requiredAverage({ hours: 30, qualityPoints: 90 }, 3.2, 30)).toBeCloseTo(3.4)
  })

  it('can come out above 4.0 when the target is out of reach', () => {
    expect(requiredAverage({ hours: 60, qualityPoints: 150 }, 3.5, 15)!).toBeGreaterThan(4)
  })

  it('needs remaining credits', () => {
    expect(requiredAverage({ hours: 60, qualityPoints: 150 }, 3.5, 0)).toBeUndefined()
  })
})

describe('formatGpa', () => {
  it('shows three places without rounding up', () => {
    expect(formatGpa(3.9996)).toBe('3.999')
    expect(formatGpa(3.5)).toBe('3.500')
    expect(formatGpa(undefined)).toBe('—')
  })
})
