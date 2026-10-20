/** Where to read about a course: its catalog search result, or its subject's course list for "CS 4XXX". */
export function catalogUrl(code: string): string {
  const [subj, num] = code.split(' ')
  if (!num || /[*X]/.test(num)) {
    return `https://catalog.vt.edu/course-descriptions/${subj.toLowerCase()}/`
  }
  return `https://catalog.vt.edu/search/?P=${encodeURIComponent(code)}`
}

/** "CS 4***" -> "CS 4XXX" */
export const displayCode = (code: string) => code.replace(/\*/g, 'X')
