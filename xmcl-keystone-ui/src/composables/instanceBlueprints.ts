import { InstanceBlueprintsServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useResourceParseErrorNotifier } from './resourceParseError'
import { useService } from './service'
import { useState } from './syncableState'
import { ReactiveResourceState } from '@/util/ReactiveResourceState'

export interface InstanceBlueprintFile {
  id: string
  path: string
  fileName: string
  size: number
  mtime: number
  hash: string
  format?: string
  blockCount?: number
  blockTypeCount?: number
  dimensions?: { x: number; y: number; z: number }
  author?: string
  materials?: { block: string; count: number }[]
  palette?: { name: string; properties?: Record<string, string> }[]
  voxels?: number[]
  modrinth?: unknown
  curseforge?: unknown
}

export const kInstanceBlueprints: InjectionKey<ReturnType<typeof useInstanceBlueprints>> = Symbol('InstanceBlueprints')

export function useInstanceBlueprints(instancePath: Ref<string>) {
  const { watch: watchBlueprints } = useService(InstanceBlueprintsServiceKey)

  const { state, error, isValidating, revalidate } = useState(
    () => instancePath.value ? watchBlueprints(instancePath.value) : undefined,
    ReactiveResourceState,
  )

  useResourceParseErrorNotifier(state)

  const blueprints = computed<InstanceBlueprintFile[]>(() => state.value?.files.map((f) => ({
    id: f.path,
    path: f.path,
    fileName: f.fileName,
    size: f.size,
    mtime: f.mtime,
    hash: f.hash,
    format: f.metadata.blueprint?.format,
    blockCount: f.metadata.blueprint?.blockCount,
    blockTypeCount: f.metadata.blueprint?.blockTypeCount,
    dimensions: f.metadata.blueprint?.size,
    author: f.metadata.blueprint?.author,
    materials: f.metadata.blueprint?.materials,
    palette: f.metadata.blueprint?.palette,
    voxels: f.metadata.blueprint?.voxels,
    modrinth: f.metadata.modrinth,
    curseforge: f.metadata.curseforge,
  })) ?? [])

  return {
    blueprints,
    error,
    isValidating,
    revalidate,
  }
}
