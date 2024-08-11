import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { File, FileModLoaderType, FileRelationType, Mod } from '@xmcl/curseforge'
import { TaskState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { getCurseforgeProjectFilesModel, getCurseforgeProjectModel } from './curseforge'
import { kSWRVConfig } from './swrvConfig'
import { kTaskManager } from './taskManager'
import { getModLoaderTypesForFile } from '@/util/curseforge'

type ProjectDependency = {
  /**
   * The type of the dependency relative to the root mod
   */
  type: FileRelationType
  /**
   * The type of the dependency relative to the parent mod
   */
  relativeType: FileRelationType
  file: File
  files: File[]
  project: Mod
  parent: Mod
}

const visit = async (dep: ProjectDependency, modLoaderType: Ref<FileModLoaderType>, gameVersion: Ref<string | undefined>, visited: Set<number>, config = injection(kSWRVConfig)): Promise<ProjectDependency[]> => {
  const { file } = dep
  if (dep.relativeType === FileRelationType.EmbeddedLibrary ||
    dep.relativeType === FileRelationType.Include ||
    dep.relativeType === FileRelationType.Incompatible
  ) {
    return []
  }
  if (visited.has(file.modId)) {
    return []
  }
  visited.add(file.modId)

  const dependencies = await Promise.all(file.dependencies.map(async (d) => {
    try {
      const modLoaderTypes = getModLoaderTypesForFile(file)
      const loaderType = modLoaderTypes.has(modLoaderType.value) ? modLoaderType.value : FileModLoaderType.Any
      const project = await getSWRV(getCurseforgeProjectModel(ref(d.modId)), config)
      const files = await getSWRV(getCurseforgeProjectFilesModel(ref(d.modId), gameVersion, ref(loaderType)), config)
      if (project && files) {
        return await visit({
          type: dep.relativeType || d.relationType,
          files: files.data,
          file: files.data[0],
          relativeType: d.relationType,
          project,
          parent: dep.project,
        }, modLoaderType, gameVersion, visited, config)
      }
    } catch (e) {
    }
    return []
  }))

  return [dep, ...dependencies.reduce((a, b) => a.concat(b), [])]
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
