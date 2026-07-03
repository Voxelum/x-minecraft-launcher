import { Blueprint, isAir } from './model'

export interface MaterialEntry {
  /**
   * The block id, e.g. `minecraft:stone`.
   */
  block: string
  count: number
}

/**
 * Compute the material list (block id -> count) for a blueprint, sorted by
 * descending count.
 */
export function getMaterialList(blueprint: Blueprint): MaterialEntry[] {
  const counts = new Map<string, number>()
  // Pre-resolve per-palette-index id + air flag.
  const ids = blueprint.palette.map((s) => (isAir(s) ? undefined : s.name))
  for (let i = 0; i < blueprint.blocks.length; i++) {
    const id = ids[blueprint.blocks[i]]
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([block, count]) => ({ block, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * The total number of non-air blocks.
 */
export function getBlockCount(blueprint: Blueprint): number {
  const air = blueprint.palette.map((s) => isAir(s))
  let count = 0
  for (let i = 0; i < blueprint.blocks.length; i++) {
    if (!air[blueprint.blocks[i]]) count++
  }
  return count
}

/**
 * The bounding volume of the blueprint.
 */
export function getVolume(blueprint: Blueprint): number {
  return blueprint.size.x * blueprint.size.y * blueprint.size.z
}
