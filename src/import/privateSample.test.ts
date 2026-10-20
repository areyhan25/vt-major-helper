import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { courseInfo, programForDars } from '../data'
import { runAudit } from '../engine/audit'
import { parseDars } from './dars'

// Runs against a real DARS report on your machine, without committing it:
//   npm run dars:text -- my-audit.pdf > private/audit.txt
//   DARS_SAMPLE=private/audit.txt npm test
const sample = process.env.DARS_SAMPLE

describe.skipIf(!sample)('private DARS sample', () => {
  it('parses and audits', () => {
    const parsed = parseDars(readFileSync(sample!, 'utf8'))
    expect(parsed.courses.length).toBeGreaterThan(0)
    const program = programForDars(parsed.programCode)
    console.log({ ...parsed, courses: parsed.courses.length, program: program?.id })
    if (!program) return
    const audit = runAudit(program, parsed.courses, courseInfo)
    for (const s of audit.sections) console.log(s.result.status.padEnd(12), s.section.title)
    console.log('credits', audit.totalCredits)
  })
})
