import { getModCompatiblity } from '@/util/modCompatible'
import { getModDependencies, ModDependency } from '@/util/modDependencies'
import { File, FileRelationType } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, getCurseforgeFileUri, getModrinthVersionUri, InstanceModsServiceKey, ModrinthServiceKey, Resource } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { kMods, useMods } from './mods'
import { useService } from './service'
import { client } from '@/util/modrinthClients'

export interface ModProject {
  icon?: string
  name?: string
}

export interface ModListFileItem {
  id: string
  name: string
  remove?: boolean
  mutex: string[]

  projectName?: string
  icon?: string

  curseforge?: File
  modrinth?: ProjectVersion
  resource?: Resource

  warnings: Array<{
    reason: 'duplicated' | 'incompatible'
    target: string
  }>

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
  const { install, disable } = useService(InstanceModsServiceKey)

  const list = ref([] as ModListFileItemParent[])
  const resourcesLookup = computed(() => {
    const dict = {} as Record<string, [string, Resource][]>
    for (const resource of mods.resources.value) {
      const mods = getModIdVersion(resource)
      for (const [id, version] of mods) {
        if (!dict[id]) {
          dict[id] = []
        }
        dict[id].push([version!, resource])
      }
    }
    return dict
  })

  /**
   * dict of the id to item path
   */
  const mutexDict = {} as Record<string, string[]>

  function getWarnings(dict: Record<string, string[]>, mutex: string[], name: string) {
    const warnings = [] as Array<{
      reason: 'duplicated' | 'incompatible'
      target: string
    }>
    for (const key of mutex) {
      if (dict[key] && dict[key].length > 0) {
        // Only if multiple conflict or the first one is not itself
        if (dict[key].length > 1 || dict[key][0] !== name) {
          const one = dict[key][0]
          warnings.push({
            reason: 'duplicated',
            target: one.substring(one.indexOf(':') + 1),
          })
        }
      }
    }
    return warnings
  }

  function getMutex(curseforge?: File, modrinth?: ProjectVersion, project?: ModProject) {
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
    return markRaw(lookups)
  }

  function addAsRemove(item: Resource, project?: ModProject) {
    const id = item.path.toString()
    const result: ModListFileItemParent = {
      id,
      mutex: [],
      name: item.fileName,
      icon: project?.icon,
      projectName: project?.name,

      warnings: [],
      curseforge: undefined,
      modrinth: undefined,
      resource: item,

      remove: true,

      enabled: true,
      dependencies: [],
    }

    list.value.push(result)

    // add to mutex dict
    for (const key of result.mutex) {
      if (!mutexDict[key]) {
        mutexDict[key] = []
      }
      mutexDict[key].push(result.name)
    }
  }

  async function add(item: File | ProjectVersion | Resource, project?: ModProject) {
    const id = 'path' in item ? item.path : 'project_id' in item ? item.id : item.id.toString()
    if (list.value.some(v => v.id === id)) return
    const name = 'path' in item ? item.fileName : 'project_id' in item ? item.name : item.displayName.toString()
    const curseforge = 'modId' in item ? item : undefined
    const modrinth = 'project_id' in item ? item : undefined
    const resource = 'path' in item ? item : undefined
    const mutex = markRaw(getMutex(curseforge, modrinth, project))
    const result: ModListFileItemParent = {
      id,
      mutex: mutex,
      name,
      icon: project?.icon,
      projectName: project?.name,

      curseforge,
      modrinth,
      resource,

      warnings: getWarnings(mutexDict, mutex, name),

      enabled: true,
      dependencies: await getDependencies(curseforge, modrinth, resource),
    }

    list.value.push(result)

    // add to mutex dict
    for (const dep of result.dependencies) {
      for (const key of dep.mutex) {
        if (!mutexDict[key]) {
          mutexDict[key] = []
        }
        mutexDict[key].push(dep.name)
      }
    }

    for (const key of result.mutex) {
      if (!mutexDict[key]) {
        mutexDict[key] = []
      }
      mutexDict[key].push(result.name)
    }
  }

  function remove(id: string) {
    const index = list.value.findIndex(i => i.id === id)
    const removed = list.value.splice(index, 1)[0]

    // remove from mutex dict

    for (const dep of removed.dependencies) {
      for (const key of dep.mutex) {
        const index = mutexDict[key].findIndex(i => i === removed.name)
        mutexDict[key].splice(index, 1)
      }
    }

    for (const key of removed.mutex) {
      const index = mutexDict[key].findIndex(i => i === removed.name)
      mutexDict[key].splice(index, 1)
    }

    for (const i of list.value) {
      if (i.warnings.length > 0) {
        i.warnings = getWarnings(mutexDict, i.mutex, i.name)
        for (const dep of i.dependencies) {
          dep.warnings = getWarnings(mutexDict, dep.mutex, dep.name)
        }
      }
    }
  }

  const { resolveFileDependencies: resolveCurseforge, getModFile, installFile } = useService(CurseForgeServiceKey)

  const { installVersion } = useService(ModrinthServiceKey)

  async function getCurseforgeDependencies(curseforge: File) {
    const result = await resolveCurseforge(curseforge)
    return result.map(([file, type]) => {
      const mutex = getMutex(file)
      // TODO: should query to determine if enabled
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
        warnings: getWarnings(mutexDict, mutex, file.displayName),
        mutex,
      }
      return item
    })
  }
  async function getModrinthDependencies(modrinth: ProjectVersion) {
    const result = await resolveModrinth(modrinth)
    const deps = modrinth.dependencies
    return result.map(v => {
      const dep = deps.find(d => (!d.version_id || d.version_id === v.id) && d.project_id === v.project_id)!
      const mutex = getMutex(undefined, v)
      const item: ModListFileItemLeave = {
        id: v.id.toString(),
        name: v.name,
        modrinth: v,
        warnings: getWarnings(mutexDict, mutex, v.name),
        type: dep.dependency_type,
        enabled: dep.dependency_type === 'required',
        mutex: mutex,
      }
      return item
    })
  }
  function getModIdVersion(res: Resource): [string, string][] | [] {
    if (res.metadata.forge) {
      return [[res.metadata.forge.modid, res.metadata.forge.version]]
    }
    if (res.metadata.fabric) {
      if (res.metadata.fabric instanceof Array) {
        return res.metadata.fabric.map(f => [f.id, f.version])
      }
      return [[res.metadata.fabric.id, res.metadata.fabric.version]]
    }
    if (res.metadata.quilt) {
      return [[res.metadata.quilt.quilt_loader.id, res.metadata.quilt.quilt_loader.version]]
    }
    return []
  }
  function getModResourceByDep(dep: ModDependency): Resource | undefined {
    const resources = resourcesLookup.value[dep.modId]
    if (!resources) return undefined
    let fallback: Resource | undefined
    for (const [version, r] of resources) {
      const com = getModCompatiblity(dep, version)
      // version is compatible
      if (com && com !== 'maybe') return r
      if (com === 'maybe' && !fallback) fallback = r
    }
    // return fallback if no suitable version found
    return fallback
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
      const version = await client.getProjectVersion(resource.metadata.modrinth.versionId).catch(() => { })
      if (version) {
        const deps = await getModrinthDependencies(version).catch(() => [])
        result.push(...deps)
      }
    }

    const modDeps = getModDependencies(resource).filter(dep => dep.modId !== 'minecraft' && dep.modId !== 'forge' && dep.modId !== 'fabricloader' && dep.modId !== 'fabric' && dep.modId !== 'java')
    for (const dep of modDeps) {
      const resource = getModResourceByDep(dep)
      const mutex = getMutex(undefined, undefined, resource).concat(['mod:' + dep.modId])
      const item: ModListFileItemLeave = {
        id: dep.modId,
        name: resource?.name || dep.modId,
        warnings: getWarnings(mutexDict, mutex, resource?.name || dep.modId),
        type: 'required',
        enabled: !!resource,
        mutex,
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
    const toInstall: Resource[] = []
    const toRemove: Resource[] = []
    const toInstallCurseforge: File[] = []
    const toInstallModrinth: ProjectVersion[] = []
    for (const i of list.value) {
      if (i.enabled && i.resource) {
        toInstall.push(i.resource)
        for (const dep of i.dependencies) {
          if (dep.enabled && dep.resource) {
            toInstall.push(dep.resource)
          }
        }
      } else if (i.enabled && i.resource) {
        toRemove.push(i.resource)
      } else if (i.enabled && i.curseforge) {
        toInstallCurseforge.push(i.curseforge)
        for (const dep of i.dependencies) {
          if (dep.enabled && dep.curseforge) {
            toInstallCurseforge.push(dep.curseforge)
          }
        }
      } else if (i.enabled && i.modrinth) {
        toInstallModrinth.push(i.modrinth)
        for (const dep of i.dependencies) {
          if (dep.enabled && dep.modrinth) {
            toInstallModrinth.push(dep.modrinth)
          }
        }
      }
    }

    // Remove the mods install successfully.
    // Keep the mods that failed to install.
    const successedToInstall: Resource[] = []
    const successedToRemove: Resource[] = []
    const successedToInstallCurseforge: File[] = []
    const successedToInstallModrinth: ProjectVersion[] = []

    await Promise.all([
      install({ mods: toInstall }).then(() => {
        successedToInstall.push(...toInstall)
      }),
      disable({ mods: toRemove }).then(() => {
        successedToRemove.push(...toRemove)
      }),
      toInstallCurseforge.map((r) => installFile({
        file: r,
        type: 'mc-mods',
        ignoreDependencies: true,
      }).then(() => {
        successedToInstallCurseforge.push(r)
      })),
      toInstallModrinth.map((r) => installVersion({
        version: r,
        ignoreDependencies: true,
      }).then(() => {
        successedToInstallModrinth.push(r)
      })),
    ])

    // Remove the successed from list
    list.value = list.value.filter(i => {
      if (i.resource && successedToInstall.includes(i.resource)) return false
      if (i.resource && successedToRemove.includes(i.resource)) return false
      if (i.curseforge && successedToInstallCurseforge.includes(i.curseforge)) return false
      if (i.modrinth && successedToInstallModrinth.includes(i.modrinth)) return false
      return true
    })
  }

  return {
    list,
    addAsRemove,
    add,
    remove,
    commit,
  }
}
