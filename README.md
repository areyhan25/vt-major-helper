# vt-major-helper
Simple and intuitive dashboard to see manage and plan courses to keep up with VT's major requirements. Cannot change enrolled courses, only serves as a planning tool.

## What it does

Pick your major, import your DARS report (or add courses by hand), and see which requirements are done, in progress, or still needed, plus how many credits are left.

Everything runs in your browser. Your DARS PDF is read locally with pdf.js and never uploaded, and your course list is saved only in this browser.

Supported so far: **Computer Science, B.S. (2025-26 catalog)**. Computer Engineering, Electrical Engineering, and Mechanical Engineering are next.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # engine and DARS importer tests
npm run build    # static site in dist/
```

## How it's organized

| Path | What's there |
|---|---|
| `src/engine/` | The audit engine: requirement schema (`types.ts`), grade rules, course pattern matching, and `runAudit` |
| `src/data/programs/` | One JSON file per major and catalog year, written from [catalog.vt.edu](https://catalog.vt.edu/undergraduate/) |
| `src/data/courses.json` | Pathways tags per course (a seed list for now) |
| `src/import/` | DARS importer: PDF to text (`pdf.ts`), then text to courses (`dars.ts`) |
| `src/components/` | The UI |

### Requirement files

Each major is a list of sections. A section has a `rule`, which is one of:

- `course`: one course, with an optional `minGrade`
- `allOf` / `anyOf`: groups of rules
- `credits`: N credits from courses matching `from` patterns (`CS 4***` matches any 4000-level CS course), minus `exclude`, or with given `pathways` tags

A course can be used once per `bucket` (`major` or `pathways`), which is how Pathways courses double count. An `exclusive` section (Degree Core) takes its courses out of every bucket. Sections with a lower `priority` claim courses first, so put broad electives last.

### Testing against your own DARS

Real reports have your name and student ID in them, so they never go in the repo. The `private/` folder is git-ignored:

```sh
npm run dars:text -- ~/Downloads/my-audit.pdf > private/audit.txt
DARS_SAMPLE=private/audit.txt npm test
```

## Disclaimer

This is an unofficial planning tool, not affiliated with Virginia Tech. Always check your official DARS audit and talk with your advisor.
