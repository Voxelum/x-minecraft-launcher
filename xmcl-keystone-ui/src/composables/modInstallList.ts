import { File, FileRelationType } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, ModrinthServiceKey, Resource } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useService } from './service'

export interface ModListFileItem {
  id: string
  name: string

  curseforge?: File
  modrinth?: ProjectVersion
  resource?: Resource

  parent: ['none'] | ['required', string] | ['optional', string] | ['incompatible', string] | ['embedded', string]

  skip: boolean
}

export const kModInstallList = Symbol('ModInstallList') as InjectionKey<ReturnType<typeof useModInstallList>>

export function useModInstallList() {
  const list = ref([] as ModListFileItem[])

  async function add(item: File | ProjectVersion | Resource) {
    const id = 'path' in item ? item.path : 'project_id' in item ? item.id : item.id.toString()
    const name = 'path' in item ? item.fileName : 'project_id' in item ? item.name : item.displayName.toString()
    const curseforge = 'modId' in item ? item : undefined
    const modrinth = 'project_id' in item ? item : undefined
    const resource = 'path' in item ? item : undefined
    const result: ModListFileItem = {
      id,
      name,
      parent: ['none'],
      skip: false,
      curseforge,
      modrinth,
      resource,
    }
    list.value.push(result, ...await refreshDependencies(result))
  }

  function remove(item: string) {
    list.value = list.value.filter(i => i.id !== item)
  }

  const { resolveFileDependencies: resolveCurseforge } = useService(CurseForgeServiceKey)
  const { resolveDependencies: resolveModrinth } = useService(ModrinthServiceKey)

  async function refreshDependencies(item: ModListFileItem) {
    const list = [] as ModListFileItem[]
    if (item.curseforge) {
      const result = await resolveCurseforge(item.curseforge)
      for (const [file, type] of result) {
        const item: ModListFileItem = {
          id: file.id.toString(),
          name: file.displayName,
          curseforge: file,
          parent: type === FileRelationType.RequiredDependency
            ? ['required', file.id.toString()]
            : type === FileRelationType.OptionalDependency
              ? ['optional', file.id.toString()]
              : type === FileRelationType.Incompatible
                ? ['incompatible', file.id.toString()]
                : type === FileRelationType.EmbeddedLibrary || type === FileRelationType.Include
                  ? ['embedded', file.id.toString()]
                  : ['none'],
          skip: false,
        }
        list.push(item)
      }
    } else if (item.modrinth) {
      const result = await resolveModrinth(item.modrinth)
      const deps = item.modrinth.dependencies
      for (const v of result) {
        const dep = deps.find(d => d.version_id === v.id && d.project_id === v.project_id)
        if (!dep) {
          continue
        }
        const item: ModListFileItem = {
          id: v.id.toString(),
          name: v.name,
          modrinth: v,
          parent: [dep.dependency_type, v.id.toString()],
          skip: false,
        }
        list.push(item)
      }
    }
    return list
  }

  return {
    list,
    add,
    remove,
  }
}
