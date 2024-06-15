import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { swrvGet } from '@/util/swrvGet'
import { File, FileModLoaderType, HashAlgo } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { InstanceFileUpdate, RuntimeVersions, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { InstanceInstallDialog } from './instanceUpdate'
import { useRefreshable } from './refreshable'
import { kSWRVConfig } from './swrvConfig'
import { useTask } from './task'

export type UpgradePlan = {
  /**
   * The curseforge file
   */
  file: File

  mod: ProjectEntry<ModFile>

  updating: boolean
} | {
  /**
   * The modrinth version
   */
  version: ProjectVersion

  mod: ProjectEntry<ModFile>

  updating: boolean
}

export const kModUpgrade: InjectionKey<ReturnType<typeof useModUpgrade>> = Symbol('kModUpgrade')

export function useModUpgrade(path: Ref<string>, runtime: Ref<RuntimeVersions>, instanceMods: Ref<ProjectEntry<ModFile>[]>) {
  const { cache, dedupingInterval } = injection(kSWRVConfig)
  const plans = ref({} as Record<string, UpgradePlan>)
  const checked = ref(false)
  const { show } = useDialog(InstanceInstallDialog)

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

  const updates = computed(() => {
    const updates: InstanceFileUpdate[] = []
    for (const plan of Object.values(plans.value)) {
      updates.push(...plan.mod.installed.map(r => ({
        operation: 'remove',
        file: {
          path: `mods/${r.resource.fileName}`,
          hashes: {
            sha1: r.hash,
          },
          size: r.resource.size,
        },
      } as InstanceFileUpdate)))
      if ('file' in plan) {
        updates.push({
          operation: 'add',
          file: {
            path: `mods/${(plan.file.fileName)}`,
            hashes: {
              sha1: plan.file.hashes.find(f => f.algo === HashAlgo.Sha1)?.value as string,
            },
            size: plan.file.fileLength,
            curseforge: {
              projectId: plan.file.modId,
              fileId: plan.file.id,
            },
          },
        })
      } else {
        const primary = plan.version.files.find(f => f.primary) || plan.version.files[0]
        updates.push({
          operation: 'add',
          file: {
            path: `mods/${(primary.filename)}`,
            hashes: primary.hashes,
            size: 0,
            modrinth: {
              projectId: plan.version.project_id,
              versionId: plan.version.id,
            },
          },
        })
      }
    }
    return updates
  })

  function upgrade() {
    show({
      type: 'updates',
      updates: updates.value,
    })
  }

  const { task } = useTask((i) => {
    if (i.path === 'installInstance') {
      return true
    }
    return false
  })
  watch(task, (newV, oldV) => {
    if (oldV && oldV.id === 'installInstance' && !newV) {
      if (oldV.state === TaskState.Succeed) {
        plans.value = {}
      }
    }
  })

  return {
    refresh,
    refreshing,
    error,
    plans,
    checked,
    upgrade,
    upgrading: computed(() => !!task.value),
  }
}
