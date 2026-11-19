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
  /** Prepend command before all the launch commands */
  prependCommand: z.optional(z.string()),
  /** Extra Java arguments */
  vmOptions: z.optional(z.array(z.string())),
})

export type Java = z.infer<typeof JavaSchema>

export const JavaRecordSchema = JavaSchema.extend({
  /** Whether this runtime was installed into the launcher's managed Java directory */
  isInternal: z.optional(z.boolean()),
  /** Prism metadata vendor used to install this managed runtime */
  installVendor: z.optional(z.string()),
  /** Previous executable awaiting reference migration and removal */
  replacesJava: z.optional(z.string()),
  replacementRuntime: z.optional(z.string()),
  /** Identity of the previous runtime when the replacement was staged */
  replacementIdentity: z.optional(z.string()),
})

/**
 * Java configuration schema containing all registered Java runtimes.
 * Zod schema for runtime validation with defaults.
 */
export const JavasSchema = z.object({
  /** All registered Java runtimes */
  all: z.array(JavaRecordSchema).default([]),
})

export type JavasSchema = z.infer<typeof JavasSchema>
