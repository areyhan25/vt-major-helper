import { z } from 'zod'

/**
 * A course pattern is "SUBJ NNNN". A "*" in the number matches any character,
 * so "CS 4***" matches every 4000-level CS course.
 */
export const CoursePattern = z.string().regex(/^[A-Z]{2,5} [0-9A-Z*]{4}[A-Z]?$/)

export type Rule =
  | { type: 'course'; course: string; minGrade?: string; label?: string }
  | { type: 'allOf'; rules: Rule[]; label?: string }
  | { type: 'anyOf'; rules: Rule[]; label?: string }
  | {
      type: 'credits'
      credits: number
      /** Minimum number of distinct courses, when the catalog says e.g. "2 courses". */
      courses?: number
      from?: string[]
      exclude?: string[]
      /** Pathways concept tags, e.g. ["5f", "5a"]. A course needs one of them. */
      pathways?: string[]
      minGrade?: string
      /** Parts of the total that must come from certain courses, e.g. "at least one 4000-level course". */
      minimums?: CreditMinimum[]
      /** Caps on what can count, e.g. "at most 3 credits from List #2". A 0-credit cap excludes. */
      limits?: CreditLimit[]
      label?: string
    }

export interface CreditMinimum {
  from: string[]
  credits?: number
  courses?: number
  /** Shown when the minimum isn't met. */
  label: string
}

export interface CreditLimit {
  credits: number
  /** Courses the cap covers. Without it, every course does (when grades match). */
  from?: string[]
  /** Grades the cap covers, e.g. ["P"] for pass/fail. Without it, every grade does. */
  grades?: string[]
  /** Shown when the cap keeps a course from counting fully. */
  label: string
}

const CreditMinimumSchema = z.object({
  from: z.array(CoursePattern),
  credits: z.number().nonnegative().optional(),
  courses: z.number().int().positive().optional(),
  label: z.string(),
})

const CreditLimitSchema = z.object({
  credits: z.number().nonnegative(),
  from: z.array(CoursePattern).optional(),
  grades: z.array(z.string()).optional(),
  label: z.string(),
})

export const RuleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('course'),
      course: CoursePattern,
      minGrade: z.string().optional(),
      label: z.string().optional(),
    }),
    z.object({ type: z.literal('allOf'), rules: z.array(RuleSchema), label: z.string().optional() }),
    z.object({ type: z.literal('anyOf'), rules: z.array(RuleSchema), label: z.string().optional() }),
    z.object({
      type: z.literal('credits'),
      credits: z.number().nonnegative(),
      courses: z.number().int().positive().optional(),
      from: z.array(CoursePattern).optional(),
      exclude: z.array(CoursePattern).optional(),
      pathways: z.array(z.string()).optional(),
      minGrade: z.string().optional(),
      minimums: z.array(CreditMinimumSchema).optional(),
      limits: z.array(CreditLimitSchema).optional(),
      label: z.string().optional(),
    }),
  ]),
)

/**
 * A course may be used once per bucket. "major" and "pathways" are separate
 * buckets, which is how Pathways courses double count with major courses.
 * An exclusive section (like Degree Core) takes a course out of every bucket.
 */
export const SectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  bucket: z.enum(['major', 'pathways']),
  exclusive: z.boolean().optional(),
  /** Lower runs first. Specific requirements should claim courses before broad electives. */
  priority: z.number().optional(),
  note: z.string().optional(),
  rule: RuleSchema,
})
export type Section = z.infer<typeof SectionSchema>

export const ProgramSchema = z.object({
  id: z.string(),
  name: z.string(),
  catalogYear: z.string(),
  /** Program codes as they appear on a DARS report, e.g. "BSCS CS". */
  darsCodes: z.array(z.string()).default([]),
  totalCredits: z.number(),
  source: z.string().url(),
  notes: z.array(z.string()).default([]),
  sections: z.array(SectionSchema),
})
export type Program = z.infer<typeof ProgramSchema>

export interface TakenCourse {
  /** Term code like "25FA". Empty for undated transfer credit. */
  term: string
  /** "CS 1114" */
  code: string
  credits: number
  /** Letter grade, or AP, TR, IP (in progress), P, W, ... */
  grade: string
  title?: string
  /** Set on planned courses that auto-plan placed. Running it again replaces them. */
  autoPlan?: {
    /** A placeholder for a requirement that leaves a choice, e.g. "CS Theory Elective". */
    slot?: string
    /** Courses (or patterns like "CS 4***") that fill the slot. */
    options?: string[]
    /** Other ways to meet the requirement, when auto-plan took the first option. */
    alts?: string[]
  }
}

/** Extra facts about courses, keyed by code. Today that's only Pathways tags. */
export type CourseInfo = Record<string, { pathways?: string[] }>
