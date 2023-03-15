import { getModCompatiblity } from '@/util/modCompatible'
import { getModDependencies, ModDependency } from '@/util/modDependencies'
import { File, FileRelationType } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, getCurseforgeFileUri, getModrinthVersionUri, InstanceModsServiceKey, ModrinthServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
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
  }

  enabled: boolean
}

export interface ModListFileItemParent extends ModListFileItem {
  dependencies: ModListFileItemLeave[]
}

export type ModListFileItemLeave = ModListFileItem & {
  type: 'required' | 'optional' | 'embedded' | 'incompatible'
}

export const kModInstallList = Symbol('ModInstallList') as InjectionKey<ReturnType<typeof useModInstallList>>

export function useModInstallList() {
  const mods = useMods()
  provide(kMods, mods)
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

  function getLookups(curseforge?: File, modrinth?: ProjectVersion, project?: ModProject) {
    const lookups = [] as string[]
    if (curseforge) {
      lookups.push(getCurseforgeFileUri(curseforge))
    }
    if (modrinth) {
      lookups.push(getModrinthVersionUri(modrinth))
    }
    if (project?.name) {
      lookups.push(`project:${project.name}`)
    }
    return lookups
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
      lookups: getLookups(curseforge, modrinth, project),
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
      dependencies: await getDependencies(curseforge, modrinth, resource),
    }

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

  async function getCurseforgeDependencies(curseforge: File) {
    const result = await resolveCurseforge(curseforge)
    return result.map(([file, type]) => {
      const item: ModListFileItemLeave = {
        id: file.id.toString(),
        name: file.displayName,
        curseforge: file,
        enabled: true,
        type: type === FileRelationType.RequiredDependency
          ? 'required'
          : type === FileRelationType.OptionalDependency || type === FileRelationType.Tool
            ? 'optional'
            : type === FileRelationType.Incompatible
              ? 'incompatible'
              : 'embedded',
        warning: {
          duplicated: '',
          incompatible: false,
        },
        lookups: getLookups(file),
      }
      return item
    })
  }
  async function getModrinthDependencies(modrinth: ProjectVersion) {
    const result = await resolveModrinth(modrinth)
    const deps = modrinth.dependencies
    return result.map(v => {
      const dep = deps.find(d => (!d.version_id || d.version_id === v.id) && d.project_id === v.project_id)!
      const item: ModListFileItemLeave = {
        id: v.id.toString(),
        name: v.name,
        modrinth: v,
        warning: {
          duplicated: '',
          incompatible: false,
        },
        type: dep.dependency_type,
        enabled: dep.dependency_type === 'required',
        lookups: getLookups(undefined, v),
      }
      return item
    })
  }
  function getModId(res: Resource) {
    if (res.metadata.forge) {
      return res.metadata.forge.modid
    }
    if (res.metadata.fabric) {
      if (res.metadata.fabric instanceof Array) {
        return res.metadata.fabric[0].id
      }
      return res.metadata.fabric.id
    }
    if (res.metadata.quilt) {
      return res.metadata.quilt.quilt_loader.id
    }
    return undefined
  }
  function getModResourceByDep(dep: ModDependency): Resource | undefined {
    const all = mods.resources
    for (const r of all.value) {
      const modId = getModId(r)
      if (modId === dep.modId) {
        return r
      }
    }
  }
  async function getResourceDependencies(resource: Resource) {
    const result = [] as ModListFileItemLeave[]
    if (resource.metadata.curseforge) {
      const mod = await getModFile({ fileId: resource.metadata.curseforge.fileId, modId: resource.metadata.curseforge.projectId }).catch(() => { })
      if (mod) {
        const deps = await getCurseforgeDependencies(mod).catch(() => [])
        result.push(...deps)
      }
    }
    if (resource.metadata.modrinth) {
      const version = await getProjectVersion(resource.metadata.modrinth.versionId).catch(() => { })
      if (version) {
        const deps = await getModrinthDependencies(version).catch(() => [])
        result.push(...deps)
      }
    }

    const modDeps = getModDependencies(resource).filter(dep => dep.modId !== 'minecraft' && dep.modId !== 'forge')
    for (const dep of modDeps) {
      const resource = getModResourceByDep(dep)
      const item: ModListFileItemLeave = {
        id: dep.modId,
        name: resource?.name || dep.modId,
        warning: {
          duplicated: '',
          incompatible: false,
        },
        type: 'required',
        enabled: !!resource,
        lookups: getLookups(undefined, undefined, resource).concat(['mod:' + dep.modId]),
      }
      result.push(item)
    }

    return result
  }
  async function getDependencies(curseforge?: File, modrinth?: ProjectVersion, resource?: Resource) {
    if (curseforge) {
      return await getCurseforgeDependencies(curseforge).catch(() => [])
    } else if (modrinth) {
      return await getModrinthDependencies(modrinth).catch(() => [])
    } else if (resource) {
      return await getResourceDependencies(resource).catch(() => [])
    }
    return []
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
