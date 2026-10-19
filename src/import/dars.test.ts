import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDars } from './dars'

// A made-up report in the same layout pdf.js produces from a real DARS PDF.
const sample = readFileSync(new URL('./fixtures/sample-dars.txt', import.meta.url), 'utf8')

describe('parseDars', () => {
  const result = parseDars(sample)

  it('reads the program and catalog year', () => {
    expect(result.programCode).toBe('BSCS CS')
    expect(result.catalogYear).toBe('Fall 2025')
    expect(result.degreeTitle).toBe('BACHELOR OF SCIENCE IN COMPUTER SCIENCE')
  })

  it('reads courses only from Course History, once each', () => {
    expect(result.fromCourseHistory).toBe(true)
    expect(result.courses).toHaveLength(17)
    expect(result.courses.filter((c) => c.code === 'CS 1114')).toHaveLength(1)
  })

  it('keeps term, credits, grade and title, including AP, transfer and in-progress courses', () => {
    expect(result.courses).toContainEqual({
      term: '25FA', code: 'CS 1114', credits: 3, grade: 'AP', title: 'Introduction Software Design',
    })
    expect(result.courses).toContainEqual(expect.objectContaining({ code: 'MATH 1XXX', grade: 'TR', credits: 1 }))
    expect(result.courses).toContainEqual(expect.objectContaining({ code: 'CS 3114', grade: 'IP' }))
    expect(result.courses).toContainEqual(expect.objectContaining({ code: 'MATH 1026', title: 'Elementary Calculus' }))
  })

  it('never keeps the name or student ID', () => {
    const json = JSON.stringify(result)
    expect(json).not.toContain('Hokie')
    expect(json).not.toContain('000000000')
  })

  it('falls back to every course line when there is no Course History section', () => {
    const r = parseDars('25FA   CS 1114   3.0   A   Intro\n25FA   CS 1114   3.0   A   Intro\n26SP   MATH 2114   3.0   B+   Linear')
    expect(r.fromCourseHistory).toBe(false)
    expect(r.courses.map((c) => c.code)).toEqual(['CS 1114', 'MATH 2114'])
  })

  it('handles the wide spacing of pdftotext output too', () => {
    const r = parseDars('             26FA     CS 1944                             1.0    IP       Computer Science 1st Yr Sem')
    expect(r.courses).toEqual([{ term: '26FA', code: 'CS 1944', credits: 1, grade: 'IP', title: 'Computer Science 1st Yr Sem' }])
  })
})
