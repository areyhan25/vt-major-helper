import { describe, expect, it } from 'vitest'
import { PRIOR, semesterKeyFor } from './semesters'
import type { TakenCourse } from './types'

const c = (code: string, term: string, grade: string): TakenCourse => ({ code, term, grade, credits: 3 })

describe('semesterKeyFor', () => {
  const courses = [
    c('FR 1105', '23FA', 'TR'),
    c('STAT 3604', '24SU', 'TR'),
    c('MATH 1225', '25FA', 'AP'),
    c('CS 2114', '25FA', 'B-'),
    c('MATH 2204', '26SU', 'TR'),
    c('CS 2505', '26SP', 'B'),
  ]
  const key = semesterKeyFor(courses)

  it('puts AP and transfer credit from before or during the first VT semester in one block', () => {
    expect(['FR 1105', 'STAT 3604', 'MATH 1225'].map((code) => key(courses.find((x) => x.code === code)!))).toEqual([
      PRIOR, PRIOR, PRIOR,
    ])
  })

  it('keeps VT courses and later transfer credit in their own semesters', () => {
    expect(key(courses[3])).toBe('25FA')
    expect(key(courses[4])).toBe('26SU')
  })
})
