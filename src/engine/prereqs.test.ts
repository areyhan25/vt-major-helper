import { describe, expect, it } from 'vitest'
import { checkPlanned, parsePrereq, unmetParts } from './prereqs'
import type { TakenCourse } from './types'

describe('parsePrereq', () => {
  it('parses codes joined by and/or with parentheses', () => {
    expect(parsePrereq('(CS 2114 or ECE 3514) and MATH 2534')).toEqual({
      op: 'and',
      parts: [{ op: 'or', parts: [{ code: 'CS 2114' }, { code: 'ECE 3514' }] }, { code: 'MATH 2534' }],
    })
  })

  it('binds and tighter than or', () => {
    expect(parsePrereq('MGT 3304 or MGT 3404 and MGT 3614')).toEqual({
      op: 'or',
      parts: [{ code: 'MGT 3304' }, { op: 'and', parts: [{ code: 'MGT 3404' }, { code: 'MGT 3614' }] }],
    })
  })

  it('accepts honors codes, upper-case AND and a trailing period', () => {
    expect(parsePrereq('MATH 2114H AND CS 1114.')).toEqual({
      op: 'and',
      parts: [{ code: 'MATH 2114H' }, { code: 'CS 1114' }],
    })
  })

  it('skips text it cannot check', () => {
    expect(parsePrereq('Junior Standing')).toBeUndefined()
    expect(parsePrereq('A grade of C or better in CS 3704.')).toBeUndefined()
    expect(parsePrereq('CS 1114, CS 2114')).toBeUndefined()
    expect(parsePrereq('(CS 1114 or CS 2114')).toBeUndefined()
  })
})

describe('unmetParts', () => {
  it('lists only the missing pieces', () => {
    const p = parsePrereq('(CS 2114 or ECE 3514) and (CS 2505 or ECE 2564) and MATH 2534')!
    expect(unmetParts(p, (c) => c === 'CS 2114')).toEqual(['CS 2505 or ECE 2564', 'MATH 2534'])
    expect(unmetParts(p, (c) => ['ECE 3514', 'ECE 2564', 'MATH 2534'].includes(c))).toEqual([])
  })
})

describe('checkPlanned', () => {
  const course = (code: string, term: string, grade = 'A'): TakenCourse => ({ code, term, grade, credits: 3 })
  const cat = { prereq: 'CS 2114 and MATH 2534', coreq: 'CS 2104' }

  it('counts finished, in-progress and earlier planned courses', () => {
    const plannedCourse = course('CS 3114', '27SP', 'PL')
    const all = [course('CS 2114', '26SP'), course('MATH 2534', '26FA', 'IP'), course('CS 2104', '27SP', 'PL'), plannedCourse]
    expect(checkPlanned(plannedCourse, all, cat)).toBeUndefined()
  })

  it('flags a prereq planned for the same semester and a failed course', () => {
    const plannedCourse = course('CS 3114', '27SP', 'PL')
    const all = [course('CS 2114', '27SP', 'PL'), course('MATH 2534', '26FA', 'F'), plannedCourse]
    expect(checkPlanned(plannedCourse, all, cat)).toEqual({ prereq: ['CS 2114', 'MATH 2534'], coreq: ['CS 2104'] })
  })
})
