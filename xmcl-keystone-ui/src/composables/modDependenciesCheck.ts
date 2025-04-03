import { TaskItem } from '@/entities/task'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime, getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { ModFile } from '@/util/mod'
import { getInstanceFileFromModrinthVersion, getModrinthModLoaders } from '@/util/modrinth'
import { getSWRV } from '@/util/swrvGet'
import { notNullish } from '@vueuse/core'
import { FileRelationType } from '@xmcl/curseforge'
import { InstanceFile, RuntimeVersions, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { InstanceInstallDialog } from './instanceUpdate'
import { getModrinthVersionModel } from './modrinthVersions'
import { useRefreshable } from './refreshable'
import { kSWRVConfig } from './swrvConfig'
import { useTask } from './task'

export const kModDependenciesCheck: InjectionKey<ReturnType<typeof useModDependenciesCheck>> = Symbol('mod-dependencies-check')

export function useModDependenciesCheck(path: Ref<string>, runtime: Ref<RuntimeVersions>, instanceMods: Ref<ModFile[]>, updateMetadata: () => Promise<void>) {
  const installation = shallowRef([] as [InstanceFile, ModFile][])
  const checked = ref(false)
  const config = inject(kSWRVConfig)
  let operationId = ''
  let operationPath = ''
  const { show } = useDialog(InstanceInstallDialog)

  async function checkModrinthDependencies(mods: ModFile[], runtimes: RuntimeVersions, result: [InstanceFile, ModFile][]) {
    const modrinthTarget = mods.filter(m => m.modrinth)
    const hashes = modrinthTarget.map(m => m.hash)

    if (hashes.length === 0) {
      console.log('Skip modrinth dependencies check due to no modrinth mods')
      return
    }

    const versions = await clientModrinthV2.getProjectVersionsByHash(hashes, 'sha1')
    const deps: Record<string, string> = {}
    const reverseDeps: Record<string, string> = {}
    for (const [sha1, version] of Object.entries(versions)) {
      for (const dep of version.dependencies) {
        if (dep.dependency_type === 'required') {
          // Check this dep existed in the installed mods
          const depMod = mods.find(m => m.modrinth?.projectId === dep.project_id)
          if (!depMod) {
            // If not, add it to the deps list
            if (dep.version_id) {
              deps[dep.project_id] = dep.version_id
            } else if (!deps[dep.project_id]) {
              deps[dep.project_id] = ''
            }
            reverseDeps[dep.project_id] = version.project_id
          }
        }
      }
    }

    const depVersions = Object.values(deps).filter(v => v)
    if (depVersions.length > 0) {
      const toInstall = await clientModrinthV2.getProjectVersionsById(depVersions)

      for (const v of toInstall) {
        delete deps[v.project_id]
        const sourceDep = reverseDeps[v.project_id]
        const file = modrinthTarget.find(m => m.modrinth!.projectId === sourceDep)!
        result.push([getInstanceFileFromModrinthVersion(v), file])
      }
    }

    const loaders = getModrinthModLoaders(runtimes, false)
    const depProjects = Object.keys(deps)
    await Promise.allSettled(depProjects.map(async (p) => {
      const v = await getSWRV(getModrinthVersionModel(p, false, loaders[0], [runtimes.minecraft]), config)
      if (v[0]) {
        const sourceDep = reverseDeps[p]
        const file = modrinthTarget.find(m => m.modrinth?.projectId === sourceDep)!
        result.push([getInstanceFileFromModrinthVersion(v[0]), file])
      }
    }))
  }

  async function checkCurseforgeDependencies(mods: ModFile[], runtimes: RuntimeVersions, result: [InstanceFile, ModFile][]) {
    const fileIds = mods.map(m => !m.modrinth ? m.curseforge?.fileId : undefined).filter(notNullish)
    if (fileIds.length === 0) {
      console.log('Skip curseforge dependencies check due to no curseforge mods')
      return
    }
    const files = await clientCurseforgeV1.getFiles(fileIds)
    let deps = [] as number[]
    const reverseDeps = {} as Record<string, string>

    for (const file of files) {
      for (const dep of file.dependencies) {
        if (dep.relationType === FileRelationType.RequiredDependency) {
          const depMod = mods.find(m => m.curseforge?.projectId === dep.modId)
          if (!depMod) {
            deps.push(dep.modId)
            reverseDeps[dep.modId] = file.modId.toString()
          }
        }
      }
    }

    deps = Array.from(new Set(deps))
    if (deps.length > 0) {
      const loader = getCurseforgeModLoaderTypeFromRuntime(runtimes)
      await Promise.allSettled(deps.map(async (d) => {
        const { data } = await clientCurseforgeV1.getModFiles({
          modId: d,
          modLoaderType: loader,
          gameVersion: runtimes.minecraft,
          pageSize: 1,
        })
        if (data[0]) {
          const sourceDep = reverseDeps[d]
          const file = mods.find(m => m.curseforge?.projectId === Number(sourceDep))!
          result.push([getInstanceFileFromCurseforgeFile(data[0]), file])
        }
      }))
    }
  }

  const { refresh, refreshing, error } = useRefreshable(async () => {
    await updateMetadata()
    await new Promise((resolve) => setTimeout(resolve, 500))

    const result: [InstanceFile, ModFile][] = []
    const mods = instanceMods.value
    const _path = path.value
    const runtimes = runtime.value

    await Promise.allSettled([
      checkModrinthDependencies(mods, runtimes, result),
      checkCurseforgeDependencies(mods, runtimes, result),
    ])

    // const similarAppend: InstanceFileUpdate[] = []
    // for (const f of result) {
    //   similarAppend.push(f)
    //   if (f.path.startsWith('/mods')) {
    //     const fileName = f.path.substring(6)
    //     const filtered = fuzzy(fileName, mods, {
    //       extract: (m) => m.path.substring(6),
    //     })
    //     const bestMatched = filtered[0]
    //     if (bestMatched) {
    //       similarAppend.push({
    //         operation: 'remove',
    //         file: {
    //           path: bestMatched.original.path,
    //           hashes: {
    //             sha1: bestMatched.original.hash,
    //           },
    //         },
    //       })
    //     }
    //   }
    // }

    installation.value = result
    checked.value = true
    operationId = crypto.getRandomValues(new Uint8Array(8)).join('')
    operationPath = _path
  })

  function apply() {
    show({
      type: 'updates',
      oldFiles: [],
      files: installation.value.map(([f]) => f),
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

  function effect() {
    onUnmounted(() => {
      installation.value = []
      checked.value = false
      operationId = ''
      operationPath = ''
    })
    watch(path, () => {
      checked.value = false
      installation.value = []
      operationId = ''
      operationPath = path.value
    })
    watch(task, (newV, oldV) => {
      if (oldV && isCurrentTask(oldV) && !newV) {
        if (oldV.state === TaskState.Succeed) {
          installation.value = []
        }
      }
    })
  }

  return {
    effect,
    refresh,
    refreshing,
    error,
    installation,
    checked,
    apply,
    installing: computed(() => !!task.value),
  }
}
