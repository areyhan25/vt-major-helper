// Scrapes every course title and description from catalog.vt.edu into src/data/catalog/<subj>.json,
// and every course's Pathways tags into src/data/courses.json.
// Usage: npm run catalog:scrape            (all subjects)
//        npm run catalog:scrape -- cs math (just these)
//
// catalog.vt.edu sits behind an AWS WAF JavaScript check, so plain fetch gets an empty page.
// This drives a real browser: it uses Chrome or Edge if installed, or the browser at CHROME_PATH.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const BASE = 'https://catalog.vt.edu'
const OUT = new URL('../src/data/catalog/', import.meta.url)
const COURSES_JSON = new URL('../src/data/courses.json', import.meta.url)

async function launch() {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, proxy })
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, proxy })
    } catch {
      // try the next one
    }
  }
  throw new Error('No browser found. Install Chrome, or set CHROME_PATH to a Chromium executable.')
}

/** Loads a page, waiting out the WAF challenge if one shows up. */
async function load(page, url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {})
    if (await page.locator('#content, .page_content').count()) return
    await page.waitForTimeout(3000)
  }
  throw new Error(`Couldn't get past the bot check for ${url}`)
}

/** Runs in the browser: parses a subject page's course blocks. */
function parseCourses() {
  const text = (el) => el?.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() || undefined
  const field = (block, cls) => {
    const el = block.querySelector(`.detail-${cls}`)
    return el && text(el)?.replace(/^[^:]+:\s*/, '')
  }
  return [...document.querySelectorAll('.courseblock')].map((block) => ({
    code: text(block.querySelector('.detail-code')),
    title: text(block.querySelector('.detail-title'))?.replace(/^-\s*/, ''),
    credits: text(block.querySelector('.detail-hours_html'))?.replace(/^\((.*)\)$/, '$1'),
    description: text(block.querySelector('.courseblockextra')),
    prereq: field(block, 'prereq'),
    coreq: field(block, 'coreq'),
    crossListed: field(block, 'cross_listed'),
    repeatability: field(block, 'repeatability'),
    pathways: field(block, 'pathway'),
  }))
}

/** "5F Quant & Comp Thnk Found., 10 Ethical Reasoning" -> ["5f", "10"] */
const pathwayCodes = (s) =>
  s
    .split(/,\s*(?=\d)/)
    .map((p) => p.match(/^(\d+[a-z]?)\b/i)?.[1].toLowerCase())
    .filter(Boolean)

/** JSON with one course per line, so a refresh diffs course by course. */
const perLine = (head, courses) =>
  JSON.stringify(head, null, 1).replace(
    /\n}$/,
    `,\n "courses": {\n${Object.entries(courses)
      .map(([code, c]) => `  ${JSON.stringify(code)}: ${JSON.stringify(c)}`)
      .join(',\n')}\n }\n}\n`,
  )

const browser = await launch()
const page = await (await browser.newContext()).newPage()

await load(page, `${BASE}/course-descriptions/`)
let subjects = await page.$$eval('a', (as) =>
  as
    .map((a) => ({ href: a.href, name: a.textContent.trim() }))
    .filter((a) => /\/course-descriptions\/[a-z_]+\/$/.test(a.href)),
)
subjects = [...new Map(subjects.map((s) => [s.href, s])).values()]
const only = process.argv.slice(2).map((s) => s.toLowerCase())
if (only.length) subjects = subjects.filter((s) => only.some((o) => s.href.endsWith(`/${o}/`)))

const scrapedAt = new Date().toISOString().slice(0, 10)
const pathways = {}
let total = 0
await mkdir(OUT, { recursive: true })
for (const { href, name } of subjects) {
  const subj = href.match(/\/course-descriptions\/([a-z_]+)\/$/)[1]
  await load(page, href)
  const parsed = await page.evaluate(parseCourses)
  const courses = {}
  for (const { code, pathways: pw, ...rest } of parsed) {
    if (!code || !rest.title) continue
    courses[code] = Object.fromEntries(Object.entries(rest).filter(([, v]) => v))
    if (pw) pathways[code] = { pathways: pathwayCodes(pw) }
  }
  total += Object.keys(courses).length
  await writeFile(
    new URL(`${subj}.json`, OUT),
    perLine({ subject: name, source: href, scrapedAt }, courses),
  )
  console.log(`${subj.padEnd(6)} ${String(Object.keys(courses).length).padStart(4)} courses`)
}
await browser.close()

// A partial run only updates the Pathways tags of the subjects it scraped.
const existing = only.length ? JSON.parse(await readFile(COURSES_JSON, 'utf8')).courses : {}
const scrapedSubj = new Set(only.map((s) => s.toUpperCase()))
const kept = Object.fromEntries(Object.entries(existing).filter(([code]) => !scrapedSubj.has(code.split(' ')[0])))
const merged = Object.fromEntries(Object.entries({ ...kept, ...pathways }).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(
  COURSES_JSON,
  perLine({ _comment: `Pathways tags per course, from catalog.vt.edu (${scrapedAt}). Regenerate with npm run catalog:scrape.` }, merged),
)
console.log(`${total} courses in ${subjects.length} subjects, ${Object.keys(pathways).length} with Pathways tags`)
