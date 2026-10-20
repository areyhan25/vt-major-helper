import type { Status } from '../engine/audit'

export const STATUS: Record<Status, { label: string; dot: string; chip: string }> = {
  done: { label: 'Done', dot: 'bg-done', chip: 'bg-done/15 text-done' },
  'in-progress': { label: 'In progress', dot: 'bg-progress', chip: 'bg-progress/15 text-burnt-soft' },
  needed: { label: 'Needed', dot: 'bg-needed', chip: 'bg-needed/15 text-needed' },
}

export const inputClass =
  'w-full rounded-lg border border-line bg-page px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-burnt focus:outline-none'
