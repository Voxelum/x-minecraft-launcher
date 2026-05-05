import { z } from 'zod'
import {
  InstanceDataWithTime,
  InstanceSchema,
  RuntimeVersionsSchema
} from './instance'

/**
 * Safely assign properties from source to target, only updating if values differ
 */
export function assignShallow<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
): boolean {
  let hasChanges = false
  for (const key in source) {
    if (source[key] !== undefined && target[key] !== source[key]) {
      target[key] = source[key]!
      hasChanges = true
    }
  }
  return hasChanges
}

/**
 * Edit options for instances - partial of InstanceSchema
 */
export const EditInstanceOptionsSchema = InstanceSchema.extend({
  runtime: RuntimeVersionsSchema.partial({
    forge: true,
    neoForged: true,
    fabricLoader: true,
    quiltLoader: true,
    optifine: true,
    labyMod: true,
  }),
}).partial()

export type EditInstanceOptions = z.infer<typeof EditInstanceOptionsSchema>

/**
 * Compute changes between current instance and edit options
 */
export async function computeInstanceEditChanges(
  currentInstance: InstanceDataWithTime,
  editOptions: EditInstanceOptions,
  getIconUrl: (path: string) => Promise<string>,
): Promise<Partial<InstanceDataWithTime>> {
  // Validate and parse edit options using Zod
  const validatedOptions = EditInstanceOptionsSchema.parse(editOptions)
  delete validatedOptions.path

  const result: Partial<InstanceDataWithTime> = {}

  // Helper to deeply compare values
  // Uses recursive comparison to handle key order differences in objects
  function deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a === null || a === undefined || b === null || b === undefined) return false
    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false
        return a.every((item, i) => deepEqual(item, b[i]))
      }

      // For objects, compare keys and values recursively
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)

      if (keysA.length !== keysB.length) return false

      return keysA.every((key) => deepEqual(a[key], b[key]))
    }

    return false
  }

  // Compute diff for each key that was explicitly provided in editOptions
  for (const key in editOptions) {
    if (key === 'path') continue

    const k = key as keyof InstanceDataWithTime
    const value = validatedOptions[k]
    const currentValue = currentInstance[k]

    // Include in result if value differs from current
    // This handles both actual changes and explicit undefined assignments (field removal)
    if (!deepEqual(currentValue, value)) {
      result[k] = value as any
    }
  }

  // Handle icon URL transformation
  if ('icon' in result && result.icon) {
    try {
      const iconURL = new URL(result.icon)
      const path = iconURL.searchParams.get('path')
      if (iconURL.host === 'launcher' && iconURL.pathname === '/media' && path) {
        result.icon = await getIconUrl(path)
      }
    } catch {
      // Invalid URL, keep as is
    }
  }

  return result
}

/**
 * Apply computed changes to an instance
 */
export function applyInstanceChanges(
  instance: InstanceDataWithTime,
  changes: Partial<InstanceDataWithTime>,
): void {
  assignShallow(instance, changes)
}
