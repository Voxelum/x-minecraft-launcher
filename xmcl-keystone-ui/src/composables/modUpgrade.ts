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
import { InstanceFile, InstanceFileUpdate, RuntimeVersions, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { useErrorHandler } from './exception'
import { InstanceInstallDialog } from './instanceUpdate'
import { useRefreshable } from './refreshable'
import { kSWRVConfig } from './swrvConfig'
import { useTask } from './task'
import { notNullish } from '@vueuse/core'
import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from './cache'
import { basename } from '@/util/basename'

export type UpgradePlan = {
  /**
   * The curseforge file
   */
  file: File

  mod: ModFile

  updating: boolean
  /**
   * Relative filepath to the instance
   */
  filePath: string
} | {
  /**
   * The modrinth version
   */
  version: ProjectVersion

  mod: ModFile

  updating: boolean
  /**
   * Relative filepath to the instance
   */
  filePath: string
}

export const kModUpgrade: InjectionKey<ReturnType<typeof useModUpgrade>> = Symbol('kModUpgrade')

export function useModUpgrade(path: Ref<string>, runtime: Ref<RuntimeVersions>, instanceMods: Ref<ModFile[]>) {
  const { cache, dedupingInterval } = injection(kSWRVConfig)
  const plans = shallowRef({} as Record<string, UpgradePlan>)
  let operationId = ''
  let operationPath = ''
  const checked = ref(false)
  const { show } = useDialog(InstanceInstallDialog)

  const skipVersion = useLocalStorageCacheBool(computed(() => `modsUpgradeSkipVersion:${path.value}`), false)
  const upgradePolicy = useLocalStorageCacheStringValue(computed(() => `modsUpgradePolicy:${path.value}`), 'modrinth')

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

  async function checkCurseforgeUpgrade(mods: ModFile[], runtime: RuntimeVersions, skipVersion: boolean, result: Record<string, UpgradePlan>) {
    const fileIds = mods.map(m => m.curseforge?.fileId).filter(notNullish)
    if (skipVersion) {
      const minecraft = runtime.minecraft
      const files = await clientCurseforgeV1.getFiles(fileIds)
      const shouldIgnored = new Set<number>()
      for (const f of files) {
        if (!f.gameVersions.includes(minecraft)) {
          shouldIgnored.add(f.id)
        }
      }
      mods = mods.filter(m => !shouldIgnored.has(m.curseforge!.projectId))
    }

    // batch 8 curseforge requests each time
    const batch = 8
    for (let i = 0; i < mods.length; i += batch) {
      await Promise.allSettled(mods.slice(i, i + batch).map(async (mod) => {
        const gameVersion = runtime.minecraft
        const modLoaderType = getCurseforgeModLoaderTypeFromRuntime(runtime)
        // this is a curseforge project and installed
        const files = await swrvGet(`/curseforge/${mod.curseforge!.projectId}/files?gameVersion=${gameVersion}&modLoaderType=${modLoaderType}&index=0`, () => clientCurseforgeV1.getModFiles({
          modId: mod.curseforge!.projectId!,
          gameVersion,
          modLoaderType,
        }), cache, dedupingInterval)
        if (files.data.length > 0) {
          const file = markRaw(files.data[0])
          const current = mod
          if (file.id !== current.curseforge?.fileId) {
            // this is the new version
            if (!result[mod.curseforge!.projectId]) {
              result[mod.curseforge!.projectId] = {
                file,
                mod,
                updating: false,
                filePath: basename(current.path),
              }
            }
          }
        }
      }))
    }
  }

  async function checkModrinthUpgrade(modrinthTarget: ModFile[], runtimes: RuntimeVersions, skipVersion: boolean, result: Record<string, UpgradePlan>) {
    const hashes = modrinthTarget.map(m => m.hash)
    if (skipVersion) {
      const minecraft = runtimes.minecraft
      const vers = await clientModrinthV2.getProjectVersionsByHash(hashes)
      const shouldIgnored = new Set<string>()
      for (const v of Object.values(vers)) {
        if (!v.game_versions.includes(minecraft)) {
          shouldIgnored.add(v.project_id)
        }
      }
      modrinthTarget = modrinthTarget.filter(m => !shouldIgnored.has(m.modrinth!.projectId))
    }

    const loaders = getModrinthModLoaders(runtimes)
    const gameVersions = [runtimes.minecraft]
    const updates = await clientModrinthV2.getLatestVersionsFromHashes(hashes, {
      algorithm: 'sha1',
      gameVersions,
      loaders,
    })
    for (const [_, version] of Object.entries(updates)) {
      const mod = modrinthTarget.find(m => m.modrinth!.projectId === version.project_id)
      const current = mod
      if (mod && current && version.id !== current?.modrinth?.versionId) {
        // this is the new version
        result[mod.modrinth!.projectId] = {
          version,
          mod,
          updating: false,
          filePath: basename(current.path),
        }
      }
    }

    return modrinthTarget
  }

  function select(mods: Set<ModFile>, isValid: (mod: ModFile) => boolean) {
    const result = [] as ModFile[]
    for (const mod of mods) {
      if (isValid(mod)) {
        result.push(mod)
        mods.delete(mod)
      }
    }
    return result
  }

  const { refresh, refreshing, error } = useRefreshable<{ skipVersion: boolean; policy: 'curseforge' | 'modrinth' | 'curseforgeOnly' | 'modrinthOnly' }>(async ({ skipVersion, policy }) => {
    const result: Record<string, UpgradePlan> = {}

    // check modrinth
    const mods = new Set(instanceMods.value)
    const runtimes = runtime.value
    const _path = path.value

    async function doCheckModrinthUpgrade() {
      const modrinthTargets = select(mods, m => !!m.modrinth?.projectId)
      await checkModrinthUpgrade(modrinthTargets, runtimes, skipVersion, result)
    }

    async function doCurseforgeUpgrade() {
      const curseforgeTargets = select(mods, m => !!m.curseforge?.projectId)
      await checkCurseforgeUpgrade(curseforgeTargets, runtimes, skipVersion, result)
    }

    if (policy === 'curseforge') {
      await doCurseforgeUpgrade()
      await doCheckModrinthUpgrade()
    } else if (policy === 'modrinth') {
      await doCheckModrinthUpgrade()
      await doCurseforgeUpgrade()
    } else if (policy === 'curseforgeOnly') {
      await doCurseforgeUpgrade()
    } else if (policy === 'modrinthOnly') {
      await doCheckModrinthUpgrade()
    }

    plans.value = result
    checked.value = true
    operationId = crypto.getRandomValues(new Uint8Array(8)).join('')
    operationPath = _path
  })

  watch(instanceMods, (mods) => {
    const modsPaths = new Set(mods.map(m => basename(m.path)))
    const plansItems = Object.entries(plans.value)
    const filtered = plansItems.filter(([_, plan]) => modsPaths.has(plan.filePath))

    plans.value = Object.fromEntries(filtered)
    checked.value = false
  })


  function upgrade() {
    const oldFiles: InstanceFile[] = []
    const files: InstanceFile[] = []
    for (const plan of Object.values(plans.value)) {
      oldFiles.push({
        path: `mods/${plan.mod.fileName}`,
        hashes: {
          sha1: plan.mod.hash,
        },
        size: plan.mod.size || 0,
      })
      files.push('file' in plan ? getInstanceFileFromCurseforgeFile(plan.file) : getInstanceFileFromModrinthVersion(plan.version))
    }

    show({
      type: 'updates',
      oldFiles,
      files,
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
    skipVersion,
    upgradePolicy,
    error,
    plans,
    checked,
    upgrade,
    upgrading: computed(() => !!task.value),
  }
}
