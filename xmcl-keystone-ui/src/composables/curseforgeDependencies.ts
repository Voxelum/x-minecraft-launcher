import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { File, FileModLoaderType, FileRelationType, Mod } from '@xmcl/curseforge'
import { TaskState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { getCurseforgeProjectFilesModel, getCurseforgeProjectModel } from './curseforge'
import { kSWRVConfig } from './swrvConfig'
import { kTaskManager } from './taskManager'

type ProjectDependency = {
  type: FileRelationType
  file: File
  files: File[]
  project: Mod
}

const visit = async (dep: ProjectDependency, modLoaderType: Ref<FileModLoaderType>, gameVersion: Ref<string | undefined>, visited: Set<number>, config = injection(kSWRVConfig)): Promise<ProjectDependency[]> => {
  const { file } = dep
  if (visited.has(file.modId)) {
    return []
  }
  visited.add(file.modId)

  const dependencies = await Promise.all(file.dependencies.map(async (dep) => {
    try {
      const modLoaderTypes = getModLoaderTypes(file)
      const loaderType = modLoaderTypes.has(modLoaderType.value) ? modLoaderType.value : FileModLoaderType.Any
      const project = await getSWRV(getCurseforgeProjectModel(ref(dep.modId)), config)
      const files = await getSWRV(getCurseforgeProjectFilesModel(ref(dep.modId), gameVersion, ref(loaderType)), config)
      if (project && files) {
        return await visit({
          type: dep.relationType,
          files: files.data,
          file: files.data[0],
          project,
        }, modLoaderType, gameVersion, visited, config)
      }
    } catch (e) {
    }
    return []
  }))

  return [dep, ...dependencies.reduce((a, b) => a.concat(b), [])]
}

function getModLoaderTypes(file: File) {
  const modLoaderTypes = new Set<FileModLoaderType>()
  if (file.sortableGameVersions) {
    for (const ver of file.sortableGameVersions) {
      if (ver.gameVersionName === 'Forge') {
        modLoaderTypes.add(FileModLoaderType.Forge)
      } else if (ver.gameVersionName === 'Fabric') {
        modLoaderTypes.add(FileModLoaderType.Fabric)
      } else if (ver.gameVersionName === 'Quilt') {
        modLoaderTypes.add(FileModLoaderType.Quilt)
      } else if (ver.gameVersionName === 'LiteLoader') {
        modLoaderTypes.add(FileModLoaderType.LiteLoader)
      }
    }
  }
  return modLoaderTypes
}

export function getCurseforgeDependenciesModel(fileRef: Ref<File | undefined>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType>, config = injection(kSWRVConfig)) {
  return {
    key: computed(() => fileRef.value && `/curseforge/file/${fileRef.value.id}/dependencies`),
    fetcher: async () => {
      const visited = new Set<number>()

      const deps = await visit({ file: fileRef.value! } as any, modLoaderType, gameVersion, visited, config)
      deps.shift()

      return deps
    },
  }
}
export function useCurseforgeDependencies(fileRef: Ref<File | undefined>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType>) {
  const config = injection(kSWRVConfig)

  return useSWRV(computed(() => fileRef.value && `/curseforge/file/${fileRef.value.id}/dependencies`), async () => {
    const visited = new Set<number>()

    const deps = await visit({ file: fileRef.value! } as any, modLoaderType, gameVersion, visited, config)
    deps.shift()

    return deps
  })
}

export function useCurseforgeTask(id: Ref<number>) {
  const { tasks } = injection(kTaskManager)
  return computed(() => {
    return tasks.value.find(t => t.state === TaskState.Running && t.path === 'installCurseforgeFile' && t.param.fileId === id.value)
  })
}
