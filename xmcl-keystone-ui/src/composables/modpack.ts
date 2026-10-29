import type { Resource } from '@xmcl/resource'
import { CachedFTBModpackVersionManifest, ModpackServiceKey, ResourceState } from '@xmcl/runtime-api'
import { useService } from './service'
import { useState } from './syncableState'
import { InjectionKey } from 'vue'

export interface ModpackItem {
  resource?: Resource
  ftb?: CachedFTBModpackVersionManifest
  type: 'raw' | 'curseforge' | 'modrinth' | 'ftb'
  tags: string[]
  name: string
  version: string
  author: string
  size: number | string
  icon: string | undefined
  id: string
}

export function useModpacks() {
  const { watchModpackFolder } = useService(ModpackServiceKey)
  return useState(watchModpackFolder, ResourceState)
}

export const kModpackExport: InjectionKey<ReturnType<typeof useModpackExport>> = Symbol('ModpackExport')

export interface ModpackModrinthContext {
  boundProjectId: Ref<string>
  bindingProject: Ref<boolean>
  creatingProject: Ref<boolean>
  unbindingProject: Ref<boolean>
  openBindDialog: () => Promise<void>
  openCreateDialog: () => Promise<void>
  openPublishDialog: (project: any) => void
  unbindProject: () => Promise<void>
}

export function useModpackExport() {
  let onExport: (() => Promise<void>) | undefined
  const exporting = ref(false)
  const loading = ref(false)
  const modrinthContext = shallowRef<ModpackModrinthContext>()

  function setExportHandler(handler?: () => Promise<void>) {
    onExport = handler
  }
  function setModrinthContext(ctx?: ModpackModrinthContext) {
    modrinthContext.value = ctx
  }
  async function exportModpack() {
    if (exporting.value) return
    if (!onExport) {
      throw new Error('No export handler set')
    }
    try {
      exporting.value = true
      await onExport()
    } finally {
      exporting.value = false
    }
  }
  return {
    loading,
    exporting,
    modrinthContext,
    setExportHandler,
    setModrinthContext,
    exportModpack,
  }
}