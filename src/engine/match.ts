/** Normalizes "cs1114", "CS-1114" or "cs 1114" to "CS 1114". */
export function normalizeCode(raw: string): string {
  const m = raw.trim().toUpperCase().match(/^([A-Z]{2,5})[\s-]*([0-9X*]{4}[A-Z]?)$/)
  return m ? `${m[1]} ${m[2]}` : raw.trim().toUpperCase()
}

export function matchesPattern(code: string, pattern: string): boolean {
  const [subj, num] = code.split(' ')
  const [psubj, pnum] = pattern.split(' ')
  if (subj !== psubj || !num || !pnum) return false
  if (pnum.length !== num.length && !(pnum.length === 4 && num.length === 5)) return false
  for (let i = 0; i < pnum.length; i++) {
    if (pnum[i] !== '*' && pnum[i] !== num[i]) return false
  }
  return true
}

export function matchesAny(code: string, patterns: string[] | undefined): boolean {
  return !!patterns?.some((p) => matchesPattern(code, p))
}
