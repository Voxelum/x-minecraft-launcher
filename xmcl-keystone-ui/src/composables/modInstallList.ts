import { injection } from '@/util/inject'
import { getModDependencies } from '@/util/modDependencies'
import { File, FileRelationType } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, ModrinthServiceKey, Resource } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { kMods } from './mods'
import { useService } from './service'

export interface ModProject {
  icon?: string
  name?: string
}

export interface ModListFileItem {
  id: string
  mutex: string
  name: string

  projectName?: string
  icon?: string

  curseforge?: File
  modrinth?: ProjectVersion
  resource?: Resource

  disabled: boolean
}

export interface ModListFileItemParent extends ModListFileItem {
  dependencies: ModListFileLeaveItem[]
  embedded: ModListFileItem[]
  incompatible: ModListFileItem[]
}

export type ModListFileLeaveItem = ModListFileItem & {
  type: 'required' | 'optional'
  parent: ModListFileItem
}

export const kModInstallList = Symbol('ModInstallList') as InjectionKey<ReturnType<typeof useModInstallList>>

export function useModInstallList() {
  const list = ref([] as ModListFileItemParent[])

  async function add(item: File | ProjectVersion | Resource, project?: ModProject) {
    const id = 'path' in item ? item.path : 'project_id' in item ? item.id : item.id.toString()
    if (list.value.some(v => v.id === id)) return
    const name = 'path' in item ? item.fileName : 'project_id' in item ? item.name : item.displayName.toString()
    const curseforge = 'modId' in item ? item : undefined
    const modrinth = 'project_id' in item ? item : undefined
    const resource = 'path' in item ? item : undefined
    const result: ModListFileItemParent = {
      id,
      mutex: '',
      name,
      icon: project?.icon,
      projectName: project?.name,

      curseforge,
      modrinth,
      resource,

      disabled: false,
      dependencies: [],
      embedded: [],
      incompatible: [],
    }
    await refreshDependencies(result)
    // const previous = list.value
    list.value.push(result)
  }

  function remove(item: string) {
    list.value = list.value.filter(i => i.id !== item)
  }

  function enable(item: ModListFileItem) {
    // if (!item.disabled) return
    // if (item.type === 'embedded') return
    // if (item.type === 'incompatible') return

    // item.disabled = false
  }

  const { resolveFileDependencies: resolveCurseforge } = useService(CurseForgeServiceKey)
  const { resolveDependencies: resolveModrinth } = useService(ModrinthServiceKey)

  async function refreshDependencies(parent: ModListFileItemParent) {
    if (parent.curseforge) {
      const result = await resolveCurseforge(parent.curseforge)
      for (const [file, type] of result) {
        const depType = type === FileRelationType.RequiredDependency
          ? 'required'
          : type === FileRelationType.OptionalDependency || type === FileRelationType.Tool
            ? 'optional'
            : type === FileRelationType.Incompatible
              ? 'incompatible'
              : 'embedded'
        const item = {
          id: file.id.toString(),
          name: file.displayName,
          curseforge: file,
          disabled: false,
          mutex: '',
        }
        if (depType === 'embedded') {
          parent.embedded.push(item)
        } else if (depType === 'incompatible') {
          parent.embedded.push(item)
        } else {
          parent.dependencies.push({
            ...item,
            parent,
            type: depType,
            disabled: depType !== 'required',
          })
        }
      }
    } else if (parent.modrinth) {
      const result = await resolveModrinth(parent.modrinth)
      const deps = parent.modrinth.dependencies
      for (const v of result) {
        const dep = deps.find(d => d.version_id === v.id && d.project_id === v.project_id)
        if (!dep) {
          continue
        }
        const item = {
          id: v.id.toString(),
          name: v.name,
          modrinth: v,
          disabled: false,
          mutex: '',
        }
        if (dep.dependency_type === 'embedded') {
          parent.embedded.push(item)
        } else if (dep.dependency_type === 'incompatible') {
          parent.incompatible.push(item)
        } else {
          parent.dependencies.push({
            ...item,
            parent,
            type: dep.dependency_type,
            disabled: dep.dependency_type !== 'required',
          })
        }
      }
    } else if (parent.resource) {
      const dependencies = (getModDependencies(parent.resource))
      for (const [k, v] of Object.entries(dependencies)) {
      }
    }
  }

  async function commit() {
    // list.value.filter(i => i.)
  }

  return {
    list,
    add,
    remove,
    commit,
  }
}
