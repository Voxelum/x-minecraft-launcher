import { File, FileRelationType, FileModLoaderType } from '@xmcl/curseforge'
import { clientCurseforgeV1 } from './clients'
import { getModLoaderTypesForFile } from './curseforge'

export async function resolveCurseforgeDependies(file: File) {
  const visited = new Set<number>()

  type Dep = [File, FileRelationType]
  const visit = async (type: FileRelationType, file: File): Promise<Dep[]> => {
    if (visited.has(file.modId)) {
      return []
    }
    visited.add(file.modId)

    const dependencies = await Promise.all(file.dependencies.map(async (dep) => {
      if (dep.relationType <= 4) {
        let gameVersion = ''
        const modLoaderTypes: FileModLoaderType[] = [...getModLoaderTypesForFile(file)]
        if (file.sortableGameVersions) {
          for (const ver of file.sortableGameVersions) {
            if (ver.gameVersion) {
              gameVersion = ver.gameVersion
              break
            }
          }
        }
        try {
          if (modLoaderTypes.length === 0) {
            modLoaderTypes.push(FileModLoaderType.Any)
          }
          for (const modLoaderType of modLoaderTypes) {
            const files = await clientCurseforgeV1.getModFiles({
              gameVersion,
              modId: dep.modId,
              modLoaderType,
              pageSize: 1,
            })
            if (files.data[0]) {
              return await visit(dep.relationType, files.data[0])
            }
          }
        } catch (e) {
        }
      }
      return []
    }))

    return [[file, type], ...dependencies.reduce((a, b) => a.concat(b), [])]
  }

  const deps = await visit(FileRelationType.RequiredDependency, file)
  deps.shift()

  return deps
}
