import { TaskItem } from '@/entities/task'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime, getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { getInstanceFileFromModrinthVersion, getModrinthModLoaders } from '@/util/modrinth'
import { ProjectEntry } from '@/util/search'
import { swrvGet } from '@/util/swrvGet'
import { File } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { InstanceFileUpdate, RuntimeVersions, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { InstanceInstallDialog } from './instanceUpdate'
import { useRefreshable } from './refreshable'
import { kSWRVConfig } from './swrvConfig'
import { useTask } from './task'
import { useErrorHandler } from './exception'
import { basename } from '@/util/basename'

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
  let operationId = ''
  let operationPath = ''
  const checked = ref(false)
  const { show } = useDialog(InstanceInstallDialog)

  useErrorHandler((e) => {
    if (e instanceof Error && 'instanceInstallErrorId' in e && e.instanceInstallErrorId === operationId) {
      error.value = e
      return true
    }
    return false
  })

  watch([path, runtime], () => {
    checked.value = false
    plans.value = {}
    operationId = ''
    error.value = null
    operationPath = path.value
  })

  async function checkCurseforgeUpgrade(runtime: RuntimeVersions, mod: ProjectEntry<ModFile>, result: Record<string, UpgradePlan>) {
    const gameVersion = runtime.minecraft
    const modLoaderType = getCurseforgeModLoaderTypeFromRuntime(runtime)
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
        if (!result[mod.id]) {
          result[mod.id] = {
            file,
            mod,
            updating: false,
          }
        }
      }
      // if (file.id !== mod.installed[0].version) {
    }
  }

  async function checkModrinthUpgrade(runtimes: RuntimeVersions, mods: ProjectEntry<ModFile>[], result: Record<string, UpgradePlan>) {
    const modrinthTarget = mods.filter(m => m.modrinthProjectId)
    const hashes = modrinthTarget.map(m => m.installed[0].hash)
    const loaders = getModrinthModLoaders(runtimes)
    const gameVersions = [runtimes.minecraft]
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
  }

  const { refresh, refreshing, error } = useRefreshable(async () => {
    const result: Record<string, UpgradePlan> = {}

    // check modrinth
    const mods = instanceMods.value
    const runtimes = runtime.value
    const _path = path.value
    await checkModrinthUpgrade(runtimes, mods, result)

    // batch 8 curseforge requests each time
    const batch = 8
    const curseforgeTarget = mods.filter(mod => mod.installed.length > 0 && mod.curseforgeProjectId)
    for (let i = 0; i < curseforgeTarget.length; i += batch) {
      await Promise.allSettled(curseforgeTarget.slice(i, i + batch).map(m => checkCurseforgeUpgrade(runtimes, m, result)))
    }
    plans.value = result
    checked.value = true
    operationId = crypto.getRandomValues(new Uint8Array(8)).join('')
    operationPath = _path
  })

  const updates = computed(() => {
    const updates: InstanceFileUpdate[] = []
    for (const plan of Object.values(plans.value)) {
      updates.push(...plan.mod.installed.map(r => ({
        operation: 'remove',
        file: {
          path: `mods/${basename(r.path)}`,
          hashes: {
            sha1: r.hash,
          },
          size: r.resource.size,
        },
      } as InstanceFileUpdate)))
      if ('file' in plan) {
        updates.push({
          operation: 'add',
          file: getInstanceFileFromCurseforgeFile(plan.file),
        })
      } else {
        updates.push({
          operation: 'add',
          file: getInstanceFileFromModrinthVersion(plan.version),
        })
      }
    }
    return updates
  })

  function upgrade() {
    show({
      type: 'updates',
      updates: updates.value,
      id: operationId,
    })
  }

  function isCurrentTask(task: TaskItem) {
    return task.path === 'installInstance' && task.param.operationId === operationId &&
      task.param.instance === operationPath
  }

  const { task } = useTask((i) => {
    if (isCurrentTask(i)) {
      return true
    }
    return false
  })
  watch(task, (newV, oldV) => {
    if (oldV && isCurrentTask(oldV) && !newV) {
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
