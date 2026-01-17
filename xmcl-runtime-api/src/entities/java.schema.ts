import { z } from 'zod'

/**
 * Java runtime information.
 * Zod schema for runtime validation.
 */
export const JavaSchema = z.object({
  /** The path to the Java executable */
  path: z.string(),
  /** The full version string of the Java runtime */
  version: z.string(),
  /** The major version number of the Java runtime */
  majorVersion: z.number(),
})

export type Java = z.infer<typeof JavaSchema>

/**
 * Java configuration schema containing all registered Java runtimes.
 * Zod schema for runtime validation with defaults.
 */
export const JavasSchema = z.object({
  /** All registered Java runtimes */
  all: z.array(JavaSchema).default([]),
})

export type JavasSchema = z.infer<typeof JavasSchema>
