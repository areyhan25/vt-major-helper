import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Status } from '../engine/audit'
import { STATUS } from './styles'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-panel ${className}`}>{children}</section>
}

export function Dot({ status }: { status: Status }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${STATUS[status].dot}`} />
}

export function Chip({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[status].chip}`}>
      {label ?? STATUS[status].label}
    </span>
  )
}

/** The key for the status dots. */
export function StatusKey({ planning }: { planning: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <Dot status="done" /> Done
      </span>
      <span className="flex items-center gap-1.5">
        <Dot status="in-progress" /> {planning ? 'In progress or planned' : 'In progress'}
      </span>
      <span className="flex items-center gap-1.5">
        <Dot status="needed" /> Still needed
      </span>
    </div>
  )
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={`size-4 shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M7.2 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 1 1-1.4-1.4L11.1 10 7.2 6.1a1 1 0 0 1 0-1.4Z" />
    </svg>
  )
}

/**
 * A small floating panel anchored to a trigger button. Closes on outside click or Escape.
 * Positioned with fixed coordinates and kept inside the viewport.
 */
export function Popover({
  trigger,
  children,
  label,
  triggerClassName = '',
}: {
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  label: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Keep the panel next to its button, inside the viewport, as the page scrolls.
  const place = useCallback(() => {
    if (!btn.current || !panel.current) return
    const b = btn.current.getBoundingClientRect()
    const p = panel.current.getBoundingClientRect()
    const margin = 8
    let top = b.bottom + 6
    if (top + p.height > window.innerHeight - margin) top = Math.max(margin, b.top - p.height - 6)
    const left = Math.min(Math.max(margin, b.left), window.innerWidth - p.width - margin)
    setPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open || !panel.current) return
    place()
    // Re-place when the content grows, e.g. a course description finishes loading.
    const observer = new ResizeObserver(place)
    observer.observe(panel.current)
    return () => observer.disconnect()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={triggerClassName}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label={label}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-80 max-w-[calc(100vw-16px)] rounded-xl border border-line bg-raised p-4 text-sm shadow-2xl shadow-black/60"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  )
}
