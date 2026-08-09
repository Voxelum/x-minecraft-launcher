import type { PartialRuntimeVersions } from '@xmcl/instance'
import type { AgentLoader } from './commands'

export function getAgentInstanceLoader(runtime: PartialRuntimeVersions): AgentLoader | undefined {
  if (runtime.neoForged) return 'neoforge'
  if (runtime.forge) return 'forge'
  if (runtime.fabricLoader) return 'fabric'
  if (runtime.quiltLoader) return 'quilt'
  return undefined
}

export function resolveAgentMarketFilters(
  runtime: PartialRuntimeVersions,
  input: { gameVersion?: string; loader?: string; all: boolean },
) {
  if (input.all) return { gameVersion: undefined, loader: undefined }
  return {
    gameVersion: (input.gameVersion ?? runtime.minecraft) || undefined,
    loader: input.loader ?? getAgentInstanceLoader(runtime),
  }
}