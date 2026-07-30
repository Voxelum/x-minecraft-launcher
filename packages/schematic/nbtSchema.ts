import { getPrototypeOf, TagType } from '@xmcl/nbt'
import type { CompoundSchema, Schema } from '@xmcl/nbt'

/**
 * Best-effort inference of an `@xmcl/nbt` schema from a runtime value.
 *
 * Objects that originate from `deserialize` already carry an exact NBT
 * prototype (which disambiguates byte/short/int, list vs. typed array, etc.) —
 * those are reused verbatim. Freshly constructed objects fall back to a
 * heuristic mapping; callers that need precise typing for known fields should
 * override them explicitly instead of relying on inference.
 */
export function inspectSchema(value: any): Schema | TagType | undefined {
  if (typeof value === 'bigint') return TagType.Long
  if (typeof value === 'boolean') return TagType.Byte
  if (typeof value === 'number') return Number.isInteger(value) ? TagType.Int : TagType.Double
  if (typeof value === 'string') return TagType.String
  if (Array.isArray(value)) {
    return [mergeArraySchema(value)] as Schema
  }
  if (value && typeof value === 'object') {
    const proto = getPrototypeOf(value)
    if (proto) return proto
    const schema: CompoundSchema = {}
    for (const [k, v] of Object.entries(value)) {
      const s = inspectSchema(v)
      if (s !== undefined) schema[k] = s as any
    }
    return schema
  }
  return undefined
}

function mergeArraySchema(arr: any[]): Schema | TagType {
  const schemas = arr.map(inspectSchema).filter((s): s is Schema | TagType => s !== undefined)
  // An empty list must still carry a (compound) element schema; a bare
  // `TagType.Compound` makes the serializer throw on `fork`, so use an empty
  // compound schema object instead.
  if (schemas.length === 0) return {}
  if (schemas.every((s) => typeof s === 'number')) return schemas[0] as TagType
  const merged: CompoundSchema = {}
  for (const s of schemas) {
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      Object.assign(merged, s)
    }
  }
  return merged
}

/**
 * Build a list schema `[elementSchema]` from an array of compounds, merging the
 * keys of every element so heterogeneous lists (e.g. mixed block entities)
 * round-trip.
 */
export function compoundListSchema(arr: any[]): Schema {
  return [mergeArraySchema(arr)] as Schema
}
