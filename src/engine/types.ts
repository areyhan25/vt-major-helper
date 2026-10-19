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
      label?: string
    }

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
}

/** Extra facts about courses, keyed by code. Today that's only Pathways tags. */
export type CourseInfo = Record<string, { pathways?: string[] }>
