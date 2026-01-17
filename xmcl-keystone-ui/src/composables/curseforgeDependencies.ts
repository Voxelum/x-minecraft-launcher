import { getModLoaderTypesForFile } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { File, FileModLoaderType, FileRelationType, Mod } from '@xmcl/curseforge'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { getCurseforgeProjectFilesModel, getCurseforgeProjectModel } from './curseforge'
import { kSWRVConfig } from './swrvConfig'
import { useTask } from './task'

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

const visit = async (current: ProjectDependency, modLoaderType: Ref<FileModLoaderType>, gameVersion: Ref<string | undefined>, visited: Set<number>, config = injection(kSWRVConfig)): Promise<ProjectDependency[]> => {
  const { file } = current
  if (current.relativeType === FileRelationType.EmbeddedLibrary ||
    current.relativeType === FileRelationType.Include ||
    current.relativeType === FileRelationType.Incompatible
  ) {
    return []
  }
  if (visited.has(file.modId)) {
    return []
  }
  visited.add(file.modId)

  const dependencies = await Promise.all(file.dependencies.map(async (child) => {
    if (child.relationType === FileRelationType.OptionalDependency) {
      return []
    }
    try {
      const modLoaderTypes = getModLoaderTypesForFile(file)
      const loaderType = modLoaderTypes.has(modLoaderType.value) ? modLoaderType.value : FileModLoaderType.Any
      const project = await getSWRV(getCurseforgeProjectModel(ref(child.modId)), config)
      const files = await getSWRV(getCurseforgeProjectFilesModel(ref(child.modId), gameVersion, ref(loaderType)), config)
      if (project && files) {
        return await visit({
          type: child.relationType === FileRelationType.RequiredDependency
            ? current.relativeType === FileRelationType.RequiredDependency
              ? FileRelationType.RequiredDependency
              : current.relativeType || child.relationType
            : child.relationType,
          files: files.data,
          file: files.data[0],
          relativeType: child.relationType,
          project,
          parent: current.project,
        }, modLoaderType, gameVersion, visited, config)
      }
    } catch (e) {
    }
    return []
  }))

  return [current, ...dependencies.reduce((a, b) => a.concat(b), [])]
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
  return useTask((t) => t.type === 'installCurseforgeFile' && t.fileId === id.value)
}
