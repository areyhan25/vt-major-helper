import { useEffect, useState } from 'react'

/** A course as catalog.vt.edu lists it. Written by scripts/scrape-catalog.mjs. */
export interface CatalogCourse {
  title: string
  /** "3 credits", "1-19 credits" */
  credits?: string
  description?: string
  prereq?: string
  coreq?: string
  crossListed?: string
  repeatability?: string
}

interface SubjectFile {
  subject: string
  source: string
  scrapedAt: string
  courses: Record<string, CatalogCourse>
}

// One file per subject, each loaded the first time one of its courses is opened.
const files = import.meta.glob<SubjectFile>('./catalog/*.json', { import: 'default' })
const loaded = new Map<string, Promise<SubjectFile | undefined>>()

export function loadSubject(subj: string): Promise<SubjectFile | undefined> {
  const key = subj.toLowerCase()
  let file = loaded.get(key)
  if (!file) {
    const load = files[`./catalog/${key}.json`]
    file = load ? load().catch(() => undefined) : Promise.resolve(undefined)
    loaded.set(key, file)
  }
  return file
}

export type CatalogLookup =
  | { status: 'loading' }
  | { status: 'found'; course: CatalogCourse; scrapedAt: string }
  | { status: 'missing' }

/** Looks a course up in the scraped catalog, e.g. "CS 3114". */
export function useCatalogCourse(code: string): CatalogLookup {
  const [result, setResult] = useState<{ code: string; lookup: CatalogLookup }>()
  useEffect(() => {
    let live = true
    loadSubject(code.split(' ')[0]).then((file) => {
      const course = file?.courses[code]
      if (live)
        setResult({ code, lookup: course ? { status: 'found', course, scrapedAt: file.scrapedAt } : { status: 'missing' } })
    })
    return () => {
      live = false
    }
  }, [code])
  return result?.code === code ? result.lookup : { status: 'loading' }
}

/** Catalog entries for several courses at once, filled in as their subject files load. */
export function useCatalogCourses(codes: string[]): Record<string, CatalogCourse> {
  const [found, setFound] = useState<Record<string, CatalogCourse>>({})
  const key = [...new Set(codes)].sort().join('|')
  useEffect(() => {
    let live = true
    const wanted = key ? key.split('|') : []
    Promise.all(wanted.map((code) => loadSubject(code.split(' ')[0]).then((f) => [code, f?.courses[code]] as const))).then(
      (pairs) => {
        if (live) setFound(Object.fromEntries(pairs.filter(([, c]) => c)) as Record<string, CatalogCourse>)
      },
    )
    return () => {
      live = false
    }
  }, [key])
  return found
}
