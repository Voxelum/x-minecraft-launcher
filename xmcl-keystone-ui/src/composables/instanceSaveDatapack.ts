import { ProjectFile } from '@/util/search'
import { InstanceDatapack, InstanceSavesServiceKey, MarketType, SaveDatapacks } from '@xmcl/runtime-api'
import { FileRelationType } from '@xmcl/curseforge'
import { Ref } from 'vue'
import useSWRV from 'swrv'
import { useService } from './service'
import { useState } from './syncableState'

export interface InstanceDatapackFile extends ProjectFile, InstanceDatapack {
}

/**
 * Watch the datapacks installed under a specific save's `datapacks/` folder.
 * @param savePath The reactive save folder path. Empty string disables the watch.
 */
export function useInstanceSaveDatapacks(savePath: Ref<string>) {
  const { watchSaveDatapacks } = useService(InstanceSavesServiceKey)
  const { state, isValidating, error, revalidate } = useState(
    () => savePath.value ? watchSaveDatapacks(savePath.value) : undefined,
    SaveDatapacks,
  )

  const datapacks = computed(() => {
    const all = state.value?.datapacks || []
    const result: InstanceDatapackFile[] = all.map((d) => ({
      ...d,
      version: '',
      enabled: true,
    }))
    return result
  })

  return {
    state,
    datapacks,
    isValidating,
    error,
    revalidate,
  }
}

/**
 * Read every datapack installed across all saves of an instance, grouped by the
 * owning save folder path. Used to render datapacks as child rows under their
 * save in the local (installed) view.
 */
export function useInstanceSavesDatapacks(instancePath: Ref<string>) {
  const { getInstanceSaveDatapacks } = useService(InstanceSavesServiceKey)
  const { data, mutate, isValidating, error } = useSWRV(
    computed(() => instancePath.value ? `/instance-save-datapacks/${instancePath.value}` : null),
    () => getInstanceSaveDatapacks(instancePath.value),
  )

  const datapacksBySave = computed(() => {
    const result: Record<string, InstanceDatapackFile[]> = {}
    for (const d of data.value || []) {
      const file: InstanceDatapackFile = { ...d, version: '', enabled: true }
      ;(result[d.savePath] ||= []).push(file)
    }
    return result
  })

  return {
    datapacksBySave,
    isValidating,
    error,
    refresh: () => mutate(),
  }
}

/**
 * Build CurseForge / Modrinth installer objects (compatible with
 * `kCurseforgeInstaller` / `kModrinthInstaller`) that install datapacks into a
 * specific save's `datapacks/` folder. Data packs are not mod-loader based, so
 * the mod-loader bootstrap step is intentionally skipped.
 */
export function useSaveDatapackInstallers(savePath: Ref<string>, onInstalled?: () => void) {
  const { installDatapackFromMarket } = useService(InstanceSavesServiceKey)

  const curseforgeInstaller = {
    install: (file: { fileId: number; icon?: string } | { fileId: number; icon?: string }[]) =>
      installDatapackFromMarket({ market: MarketType.CurseForge, file, savePath: savePath.value }),
    installWithDependencies: async (
      fileId: number,
      _loaders: string[],
      icon: string | undefined,
      _installed: ProjectFile[],
      deps: Array<{ type: FileRelationType; file: { id: number }; project: { logo?: { url?: string } } }>,
    ) => {
      const files = (deps ?? [])
        .filter((v) => v.type === FileRelationType.RequiredDependency)
        .map((v) => ({ fileId: v.file.id, icon: v.project.logo?.url }))
      files.push({ fileId, icon })
      await installDatapackFromMarket({ market: MarketType.CurseForge, file: files, savePath: savePath.value })
      onInstalled?.()
    },
  }

  const modrinthInstaller = {
    install: (version: { versionId: string; icon?: string } | { versionId: string; icon?: string }[]) =>
      installDatapackFromMarket({ market: MarketType.Modrinth, version, savePath: savePath.value }),
    installWithDependencies: async (
      versionId: string,
      _loaders: string[],
      icon: string | undefined,
      _installed: ProjectFile[],
      deps: Array<{ type: string; recommendedVersion: { id: string }; project: { icon_url?: string } }>,
    ) => {
      const versions = (deps ?? [])
        .filter((v) => v.type === 'required')
        .map((v) => ({ versionId: v.recommendedVersion.id, icon: v.project.icon_url }))
      versions.push({ versionId, icon })
      await installDatapackFromMarket({ market: MarketType.Modrinth, version: versions, savePath: savePath.value })
      onInstalled?.()
      return true
    },
  }

  return { curseforgeInstaller, modrinthInstaller }
}

