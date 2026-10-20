const SEASON: Record<string, number> = { WI: 0, SP: 1, SU: 2, FA: 3 }
const SEASON_NAME: Record<string, string> = { WI: 'Winter', SP: 'Spring', SU: 'Summer', FA: 'Fall' }

/** "26SP" -> 261, so terms sort in calendar order. Undated credit sorts first. */
export function termOrder(term: string): number {
  const m = term.match(/^(\d{2})(WI|SP|SU|FA)$/)
  return m ? Number(m[1]) * 10 + SEASON[m[2]] : -1
}

/** "25FA" -> "Fall 2025". */
export function termLabel(term: string): string {
  const m = term.match(/^(\d{2})(WI|SP|SU|FA)$/)
  return m ? `${SEASON_NAME[m[2]]} 20${m[1]}` : 'Other credit'
}

/** The next `count` Spring, Summer and Fall terms after `term`. */
export function termsAfter(term: string, count: number): string[] {
  const m = term.match(/^(\d{2})(WI|SP|SU|FA)$/)
  let year = m ? Number(m[1]) : new Date().getFullYear() % 100
  let season = m ? m[2] : 'SU'
  const out: string[] = []
  while (out.length < count) {
    if (season === 'SP') season = 'SU'
    else if (season === 'SU') season = 'FA'
    else {
      season = 'SP'
      year++
    }
    out.push(`${String(year).padStart(2, '0')}${season}`)
  }
  return out
}
