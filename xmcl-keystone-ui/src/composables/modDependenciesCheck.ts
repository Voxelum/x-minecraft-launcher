import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime, getCursforgeFileModLoaders, getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { ModFile } from '@/util/mod'
import { getInstanceFileFromModrinthVersion, getModrinthModLoaders } from '@/util/modrinth'
import { notNullish } from '@vueuse/core'
import { FileRelationType } from '@xmcl/curseforge'
import { InstanceFileUpdate, RuntimeVersions, TaskState } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { InstanceInstallDialog } from './instanceUpdate'
import { useRefreshable } from './refreshable'
import { useTask } from './task'
import { kInstanceModsContext } from './instanceMods'
import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { getModrinthVersionModel } from './modrinthVersions'
import { kSWRVConfig } from './swrvConfig'
import { TaskItem } from '@/entities/task'
import { filter as fuzzy } from 'fuzzy'

export function useModDependenciesCheck(path: Ref<string>, runtime: Ref<RuntimeVersions>) {
  const { mods: instanceMods, updateMetadata } = injection(kInstanceModsContext)
  const updates = ref([] as InstanceFileUpdate[])
  const checked = ref(false)
  const config = inject(kSWRVConfig)
  let operationId = ''
  let operationPath = ''
  const { show } = useDialog(InstanceInstallDialog)

  async function checkModrinthDependencies(mods: ModFile[], runtimes: RuntimeVersions, result: InstanceFileUpdate[]) {
    const modrinthTarget = mods.filter(m => m.modrinth)
    const hashes = modrinthTarget.map(m => m.hash)
    const versions = await clientModrinthV2.getProjectVersionsByHash(hashes, 'sha1')
    const deps: Record<string, string> = {}
    for (const [sha1, version] of Object.entries(versions)) {
      for (const dep of version.dependencies) {
        if (dep.dependency_type === 'required') {
          // Check this dep existed in the installed mods
          const depMod = mods.find(m => m.modrinth?.projectId === dep.project_id)
          if (!depMod) {
            // If not, add it to the deps list
            if (dep.version_id) {
              deps[dep.project_id] = dep.version_id
            } else {
              if (!deps[dep.project_id]) {
                deps[dep.project_id] = ''
              }
            }
          }
        }
      }
    }

    const depVersions = Object.values(deps).filter(v => v)
    if (depVersions.length > 0) {
      const toInstall = await clientModrinthV2.getProjectVersionsById(depVersions)

      for (const v of toInstall) {
        delete deps[v.project_id]
        result.push({
          operation: 'add',
          file: getInstanceFileFromModrinthVersion(v),
        })
      }
    }

    const loaders = getModrinthModLoaders(runtimes, false)
    const depProjects = Object.keys(deps)
    await Promise.allSettled(depProjects.map(async (p) => {
      const v = await getSWRV(getModrinthVersionModel(p, false, loaders, [runtimes.minecraft]), config)
      if (v[0]) {
        result.push({
          operation: 'add',
          file: getInstanceFileFromModrinthVersion(v[0]),
        })
      }
    }))
  }

  async function checkCurseforgeDependencies(mods: ModFile[], runtimes: RuntimeVersions, result: InstanceFileUpdate[]) {
    const fileIds = mods.map(m => !m.modrinth ? m.curseforge?.fileId : undefined).filter(notNullish)
    const files = await clientCurseforgeV1.getFiles(fileIds)
    let deps = [] as number[]
    for (const file of files) {
      for (const dep of file.dependencies) {
        if (dep.relationType === FileRelationType.RequiredDependency) {
          const depMod = mods.find(m => m.curseforge?.projectId === dep.modId)
          if (!depMod) {
            deps.push(dep.modId)
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
          result.push({
            operation: 'add',
            file: getInstanceFileFromCurseforgeFile(data[0]),
          })
        }
      }))
    }
  }

  const { refresh, refreshing, error } = useRefreshable(async () => {
    await updateMetadata()
    await new Promise((resolve) => setTimeout(resolve, 500))

    const result: InstanceFileUpdate[] = []
    const mods = instanceMods.value
    const _path = path.value
    const runtimes = runtime.value

    await Promise.allSettled([
      checkModrinthDependencies(mods, runtimes, result),
      checkCurseforgeDependencies(mods, runtimes, result),
    ])

    const similarAppend: InstanceFileUpdate[] = []
    for (const f of result) {
      similarAppend.push(f)
      if (f.file.path.startsWith('/mods')) {
        const fileName = f.file.path.substring(6)
        const filtered = fuzzy(fileName, mods, {
          extract: (m) => m.path.substring(6),
        })
        const bestMatched = filtered[0]
        if (bestMatched) {
          similarAppend.push({
            operation: 'remove',
            file: {
              path: bestMatched.original.path,
              hashes: {
                sha1: bestMatched.original.hash,
              },
            },
          })
        }
      }
    }

    updates.value = result
    checked.value = true
    operationId = crypto.getRandomValues(new Uint8Array(8)).join('')
    operationPath = _path
  })

  watch([path], () => {
    checked.value = false
    updates.value = []
    operationId = ''
    operationPath = path.value
  })

  function apply() {
    show({
      type: 'updates',
      updates: updates.value,
      id: operationId,
      selectOnlyAdd: true,
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
        updates.value = []
      }
    }
  })

  return {
    refresh,
    refreshing,
    error,
    updates,
    checked,
    apply,
    installing: computed(() => !!task.value),
  }
}
