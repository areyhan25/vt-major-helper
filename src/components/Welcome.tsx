import { useId, useState } from 'react'
import type { Program } from '../engine/types'
import hokieBird from '../assets/hokie-bird.png'

/** Short name a student might type, from the DARS code: "BSCS CS" becomes "CS". */
function abbreviation(p: Program) {
  return p.darsCodes[0]?.split(' ').at(-1) ?? ''
}

function matches(p: Program, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return p.name.toLowerCase().includes(q) || abbreviation(p).toLowerCase().startsWith(q)
}

/** The first page: a big "Choose your major" and a search box that suggests the majors we support. */
export function Welcome({ programs, onPick }: { programs: Program[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(true)
  const [active, setActive] = useState(0)
  const listId = useId()

  const results = programs.filter((p) => matches(p, query))
  const highlighted = Math.min(active, results.length - 1)

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && results[highlighted]) {
      e.preventDefault()
      onPick(results[highlighted].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-[18vh] pb-8">
      <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-maroon to-burnt text-lg font-bold text-white shadow-lg shadow-maroon/30">
        VT
      </div>
      <h1 className="mt-6 text-center text-4xl font-semibold tracking-tight sm:text-5xl">Choose your major</h1>

      <div className="relative mt-8 w-full max-w-lg">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint"
        >
          <path d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.63 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" />
        </svg>
        <input
          autoFocus
          role="combobox"
          aria-label="Search majors"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[highlighted] ? `${listId}-${results[highlighted].id}` : undefined}
          placeholder="Search majors, like Computer Science or CS"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-line bg-panel py-3.5 pr-4 pl-12 text-base text-ink placeholder:text-faint focus:border-burnt focus:outline-none"
        />

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Majors"
            className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl shadow-black/40"
          >
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">
                No match. Right now the app has {programs.map(abbreviation).join(', ')}.
              </li>
            ) : (
              results.map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-${p.id}`}
                  role="option"
                  aria-selected={i === highlighted}
                  // mousedown, so the pick lands before the input loses focus
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onPick(p.id)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                    i === highlighted ? 'bg-raised text-ink' : 'text-muted'
                  }`}
                >
                  <span>
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className="ml-2 text-xs text-faint">{p.catalogYear} catalog</span>
                  </span>
                  <span className="rounded-md bg-maroon/25 px-2 py-0.5 text-xs font-semibold text-burnt-soft">
                    {abbreviation(p)}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* fills the space between the search box and the footer, so the bird sits centered in it */}
      <div className="flex flex-1 items-center py-10">
        <img src={hokieBird} alt="The HokieBird" className="h-48 w-auto select-none sm:h-56" draggable={false} />
      </div>

      <p className="max-w-md text-center text-xs leading-relaxed text-faint">
        Unofficial planning tool. Always check your official DARS and talk with your advisor. Your courses stay in this
        browser.
      </p>
    </div>
  )
}

/** A short pause after picking a major, so the switch to the audit feels deliberate. */
export function MajorLoading({ program }: { program: Program }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="grid size-14 animate-pulse place-items-center rounded-full bg-gradient-to-br from-maroon to-burnt text-lg font-bold text-white shadow-lg shadow-maroon/30">
        VT
      </div>
      <div className="mt-6 text-center text-2xl font-semibold tracking-tight">{program.name}</div>
      <div className="mt-1 text-sm text-muted">Setting up your degree audit…</div>
      <div className="mt-6 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-raised">
        <div className="loading-bar h-full rounded-full bg-gradient-to-r from-maroon to-burnt" />
      </div>
    </div>
  )
}
