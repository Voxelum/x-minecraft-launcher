import { File, FileRelationType, FileModLoaderType, Mod } from '@xmcl/curseforge'
import { clientCurseforgeV1 } from '@/util/clients'
import { injection } from '@/util/inject'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { swrvGet } from '@/util/swrvGet'
import { kSWRVConfig } from './swrvConfig'
import { kTaskManager } from './taskManager'
import { TaskState } from '@xmcl/runtime-api'

export function useCurseforgeDependencies(fileRef: Ref<File | undefined>, gameVersion: Ref<string | undefined>, modLoaderType: Ref<FileModLoaderType>) {
  const config = injection(kSWRVConfig)

  return useSWRV(computed(() => fileRef.value && `/curseforge/file/${fileRef.value.id}/dependencies`), async () => {
    const visited = new Set<number>()

    type ProjectDependency = {
      type: FileRelationType
      file: File
      files: File[]
      project: Mod
    }
    const visit = async (dep: ProjectDependency): Promise<ProjectDependency[]> => {
      const { file } = dep
      if (visited.has(file.modId)) {
        return []
      }
      visited.add(file.modId)

      console.log(file.dependencies)

      const dependencies = await Promise.all(file.dependencies.map(async (dep) => {
        // const gameVersions = file.sortableGameVersions?.filter(f => f.gameVersion).map(f => f.gameVersion)
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
        try {
          const loaderType = modLoaderTypes.has(modLoaderType.value) ? modLoaderType.value : FileModLoaderType.Any
          const version = gameVersion.value
          const project = await swrvGet(
            `/curseforge/${dep.modId}`,
            () => clientCurseforgeV1.getMod(dep.modId),
            config.cache, config.dedupingInterval,
          )
          const files = await swrvGet(
            `/curseforge/${file.id}/files?gameVersion=${gameVersion}&modLoaderType=${loaderType}&index=${0}`,
            () => clientCurseforgeV1.getModFiles({
              modId: dep.modId,
              index: 0,
              gameVersion: version,
              pageSize: 30,
              modLoaderType: loaderType,
            }),
            config.cache, config.dedupingInterval,
          )
          return await visit({
            type: dep.relationType,
            files: files.data,
            file: files.data[0],
            project,
          })
        } catch (e) {
        }
        return []
      }))

      return [dep, ...dependencies.reduce((a, b) => a.concat(b), [])]
    }

    const deps = await visit({ file: fileRef.value! } as any)
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
