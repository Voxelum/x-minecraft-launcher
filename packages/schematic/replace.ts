import { Blueprint, BlockState, blockStateEquals, isAir, parseBlockState } from './model'

export enum ReplaceMode {
  /**
   * Match by block id only and keep the existing block state properties — only
   * the id is swapped. (简单模式)
   */
  Simple = 'simple',
  /**
   * Match the full block state (id + properties) and replace it entirely. (精准模式)
   */
  Precise = 'precise',
}

export interface BlockReplacement {
  from: BlockState | string
  to: BlockState | string
}

function toState(input: BlockState | string): BlockState {
  return typeof input === 'string' ? parseBlockState(input) : input
}

/**
 * Replace blocks in a blueprint in place. Returns the number of block cells
 * affected.
 */
export function replaceBlocks(
  blueprint: Blueprint,
  replacements: BlockReplacement[],
  mode: ReplaceMode = ReplaceMode.Simple,
): number {
  const rules = replacements.map((r) => ({ from: toState(r.from), to: toState(r.to) }))

  // Pre-compute, per palette index, the replacement target (if any).
  const newPalette = blueprint.palette.slice()
  const changedIndices = new Set<number>()

  for (let i = 0; i < newPalette.length; i++) {
    const state = newPalette[i]
    for (const rule of rules) {
      if (mode === ReplaceMode.Simple) {
        if (state.name === rule.from.name) {
          newPalette[i] = { name: rule.to.name, properties: state.properties }
          changedIndices.add(i)
          break
        }
      } else {
        if (blockStateEquals(state, rule.from)) {
          newPalette[i] = { name: rule.to.name, properties: rule.to.properties }
          changedIndices.add(i)
          break
        }
      }
    }
  }

  if (changedIndices.size === 0) return 0

  blueprint.palette = newPalette
  let affected = 0
  for (let i = 0; i < blueprint.blocks.length; i++) {
    if (changedIndices.has(blueprint.blocks[i])) affected++
  }
  return affected
}

/**
 * The distinct block ids used in the blueprint (excluding air).
 */
export function getUsedBlocks(blueprint: Blueprint): string[] {
  const used = new Set<string>()
  const seen = new Set<number>()
  for (let i = 0; i < blueprint.blocks.length; i++) {
    const idx = blueprint.blocks[i]
    if (seen.has(idx)) continue
    seen.add(idx)
    const state = blueprint.palette[idx]
    if (!isAir(state)) used.add(state.name)
  }
  return [...used].sort()
}
