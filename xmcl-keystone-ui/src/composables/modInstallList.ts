import { getModDependencies } from '@/util/modDependencies'
import { File, FileRelationType } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, InstanceModsServiceKey, ModrinthServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, set } from 'vue'
import { kMods, useMods } from './mods'
import { useService } from './service'

export interface ModProject {
  icon?: string
  name?: string
}

export interface ModListFileItem {
  id: string
  name: string
  lookups: string[]

  projectName?: string
  icon?: string

  curseforge?: File
  modrinth?: ProjectVersion
  resource?: Resource

  warning: {
    duplicated: string
    incompatible: boolean
    // conflict:
  }

  enabled: boolean
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
  const mods = useMods()
  provide(kMods, mods)
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { install } = useService(InstanceModsServiceKey)

  const list = ref([] as ModListFileItemParent[])
  // store the id to item path
  const mutexDict = {} as Record<string, string[]>
  const persistedMutexDict = computed(() => {
    const dict = {} as Record<string, string[]>
    for (const item of mods.resources.value) {
      // if (item.metadata)
      // const id = item.id.toString()
      // const path = item.path
      // if (!dict[id]) {
      //   dict[id] = []
      // }
      // dict[id].push(path)
    }
  })

  function refreshWarning(dict: Record<string, string[]>, result: ModListFileItemParent, curseforge?: File, modrinth?: ProjectVersion, resource?: Resource) {
    for (const key of result.lookups) {
      if (dict[key]) {
        const one = dict[key][0]
        result.warning.duplicated = one.substring(one.indexOf(':') + 1)
        return
      }
    }
    result.warning.duplicated = ''
    result.enabled = true
  }

  function decorateLookup(result: ModListFileItem, curseforge?: File, modrinth?: ProjectVersion, project?: ModProject) {
    if (curseforge) {
      result.lookups.push(`curseforge:${curseforge.modId}`)
    }
    if (modrinth) {
      result.lookups.push(`modrinth:${modrinth.project_id}`)
    }
    if (project?.name) {
      result.lookups.push(`project:${project.name}`)
    }
  }

  async function add(item: File | ProjectVersion | Resource, project?: ModProject) {
    const id = 'path' in item ? item.path : 'project_id' in item ? item.id : item.id.toString()
    if (list.value.some(v => v.id === id)) return
    const name = 'path' in item ? item.fileName : 'project_id' in item ? item.name : item.displayName.toString()
    const curseforge = 'modId' in item ? item : undefined
    const modrinth = 'project_id' in item ? item : undefined
    const resource = 'path' in item ? item : undefined
    const result: ModListFileItemParent = {
      id,
      lookups: [],
      name,
      icon: project?.icon,
      projectName: project?.name,

      curseforge,
      modrinth,
      resource,

      warning: {
        duplicated: '',
        incompatible: false,
      },

      enabled: true,
      dependencies: [],
      embedded: [],
      incompatible: [],
    }

    decorateLookup(result, curseforge, modrinth, project)
    await refreshDependencies(result)
    refreshWarning(mutexDict, result, curseforge, modrinth, resource)
    list.value.push(result)

    // add to mutex dict
    for (const key of result.lookups) {
      if (!mutexDict[key]) {
        mutexDict[key] = []
      }
      mutexDict[key].push(result.name)
    }
  }

  function remove(item: string) {
    const index = list.value.findIndex(i => i.id !== item)
    const removed = list.value.splice(index, 1)[0]

    // remove from mutex dict
    for (const key of removed.lookups) {
      const index = mutexDict[key].findIndex(i => i === removed.id)
      mutexDict[key].splice(index, 1)
    }

    for (const i of list.value) {
      if (i.warning.duplicated) {
        refreshWarning(mutexDict, i, i.curseforge, i.modrinth, i.resource)
      }
    }
  }

  const { resolveFileDependencies: resolveCurseforge, getModFile } = useService(CurseForgeServiceKey)

  const { resolveDependencies: resolveModrinth, getProjectVersion } = useService(ModrinthServiceKey)

  async function refreshDependencies(parent: ModListFileItemParent) {
    const processCurseforge = async (curseforge: File) => {
      const result = await resolveCurseforge(curseforge)
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
          enabled: true,
          warning: {
            duplicated: '',
            incompatible: false,
          },
          lookups: [],
        }
        decorateLookup(item, file)
        if (depType === 'embedded') {
          parent.embedded.push(item)
        } else if (depType === 'incompatible') {
          parent.embedded.push(item)
        } else {
          parent.dependencies.push({
            ...item,
            parent,
            type: depType,
            enabled: depType === 'required',
          })
        }
      }
    }
    const processModrinth = async (modrinth: ProjectVersion) => {
      const result = await resolveModrinth(modrinth)
      const deps = modrinth.dependencies
      for (const v of result) {
        const dep = deps.find(d => (!d.version_id || d.version_id === v.id) && d.project_id === v.project_id)
        if (!dep) {
          continue
        }
        const item = {
          id: v.id.toString(),
          name: v.name,
          modrinth: v,
          enabled: true,
          warning: {
            duplicated: '',
            incompatible: false,
          },
          lookups: [],
        }
        decorateLookup(item, undefined, v)
        if (dep.dependency_type === 'embedded') {
          parent.embedded.push(item)
        } else if (dep.dependency_type === 'incompatible') {
          parent.incompatible.push(item)
        } else {
          parent.dependencies.push({
            ...item,
            parent,
            type: dep.dependency_type,
            enabled: dep.dependency_type === 'required',
          })
        }
      }
    }
    if (parent.curseforge) {
      await processCurseforge(parent.curseforge).catch(() => { })
    } else if (parent.modrinth) {
      await processModrinth(parent.modrinth).catch(() => { })
    } else if (parent.resource) {
      if (parent.resource.metadata.modrinth) {
        const version = await getProjectVersion(parent.resource.metadata.modrinth.versionId).catch(() => { })
        if (version) {
          await processModrinth(version).catch(() => { })
        }
      }
      if (parent.resource.metadata.curseforge) {
        const mod = await getModFile({ fileId: parent.resource.metadata.curseforge.fileId, modId: parent.resource.metadata.curseforge.projectId }).catch(() => { })
        if (mod) {
          await processCurseforge(mod).catch(() => { })
        }
      }
      const dependencies = getModDependencies(parent.resource).filter(d => d.modId !== 'minecraft' && d.modId !== 'forge')
      for (const dep of dependencies) {

      }
    }
  }

  async function commit() {
    const resources = list.value.filter(i => i.enabled && i.resource).map(l => l.resource!)
    await install({ mods: resources })
  }

  return {
    list,
    add,
    remove,
    commit,
  }
}
