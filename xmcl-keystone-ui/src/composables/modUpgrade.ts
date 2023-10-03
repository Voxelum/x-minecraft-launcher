import { Mod, ModFile } from '@/util/mod'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { InjectionKey, Ref } from 'vue'
import { InstanceModsServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { swrvGet } from '@/util/swrvGet'
import { injection } from '@/util/inject'
import { kSWRVConfig } from './swrvConfig'
import { FileModLoaderType, File } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { useRefreshable } from './refreshable'
import { useCurseforgeInstallModFile } from './curseforgeInstall'
import { useModrinthInstallVersion } from './modrinthInstall'
import { useService } from './service'

export type UpgradePlan = {
  /**
   * The curseforge file
   */
  file: File

  mod: Mod

  updating: boolean
} | {
  /**
   * The modrinth version
   */
  version: ProjectVersion

  mod: Mod

  updating: boolean
}

export const kModUpgrade: InjectionKey<ReturnType<typeof useModUpgrade>> = Symbol('kModUpgrade')

export function useModUpgrade(path: Ref<string>, runtime: Ref<RuntimeVersions>, instanceMods: Ref<Mod[]>) {
  const { cache, dedupingInterval } = injection(kSWRVConfig)
  const plans = ref({} as Record<string, UpgradePlan>)
  const checked = ref(false)

  watch([path, runtime], () => {
    checked.value = false
    plans.value = {}
  })

  const { refresh, refreshing, error } = useRefreshable(async () => {
    const result: Record<string, UpgradePlan> = {}

    // check modrinth
    const modrinthTarget = instanceMods.value.filter(m => m.modrinthProjectId)
    const hashes = modrinthTarget.map(m => m.installed[0].hash)
    const loaders = (runtime.value.forge || runtime.value.neoForged) ? ['forge'] : runtime.value.fabricLoader ? ['fabric'] : runtime.value.quiltLoader ? ['quilt'] : []
    const gameVersions = [runtime.value.minecraft]
    const updates = await clientModrinthV2.getLatestVersionsFromHashes(hashes, {
      algorithm: 'sha1',
      gameVersions,
      loaders,
    })
    for (const [_, version] of Object.entries(updates)) {
      const mod = modrinthTarget.find(m => m.modrinthProjectId === version.project_id)
      const current = mod?.installed[0]
      if (mod && version.id !== current?.modrinth?.versionId) {
        // this is the new version
        result[mod.id] = {
          version,
          mod,
          updating: false,
        }
      }
    }

    for (const mod of instanceMods.value) {
      if (mod.installed.length > 0 && mod.curseforgeProjectId) {
        const gameVersion = runtime.value.minecraft
        const modLoaderType = (runtime.value.forge || runtime.value.neoForged)
          ? FileModLoaderType.Forge
          : runtime.value.fabricLoader
            ? FileModLoaderType.Fabric
            : runtime.value.quiltLoader
              ? FileModLoaderType.Quilt
              : FileModLoaderType.Any
        // this is a curseforge project and installed
        const files = await swrvGet(`/curseforge/${mod.curseforgeProjectId}/files?gameVersion=${gameVersion}&modLoaderType=${modLoaderType}&index=0`, () => clientCurseforgeV1.getModFiles({
          modId: mod.curseforgeProjectId!,
          gameVersion,
          modLoaderType,
        }), cache, dedupingInterval)
        if (files.data.length > 0) {
          const file = markRaw(files.data[0])
          const current = mod.installed[0]
          if (file.id !== current.curseforge?.fileId) {
            // this is the new version
            result[mod.id] = {
              file,
              mod,
              updating: false,
            }
          }
          // if (file.id !== mod.installed[0].version) {
        }
      }
    }
    plans.value = result
    checked.value = true
  })

  const installCurseforgeFile = useCurseforgeInstallModFile(path)
  const installModrinthVersion = useModrinthInstallVersion(path)
  const { uninstall: uninstallMod } = useService(InstanceModsServiceKey)
  const { refresh: upgrade, refreshing: upgrading, error: upgradeError } = useRefreshable(async () => {
    for (const plan of Object.values(plans.value)) {
      if ('file' in plan) {
        plan.updating = true
        try {
          await uninstallMod({ mods: plan.mod.installed.map(i => i.resource), path: path.value })
          await installCurseforgeFile(plan.file)
        } finally {
          plan.updating = false
        }
      } else {
        plan.updating = true
        try {
          await uninstallMod({ mods: plan.mod.installed.map(i => i.resource), path: path.value })
          await installModrinthVersion(plan.version)
        } finally {
          plan.updating = false
        }
      }
    }
    plans.value = {}
  })

  return {
    refresh,
    refreshing,
    error,
    plans,
    checked,
    upgrade,
    upgrading,
    upgradeError,
  }
}
