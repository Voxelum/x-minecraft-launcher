import { getModCompatiblity } from '@/util/modCompatible'
import { getModDependencies, ModDependency } from '@/util/modDependencies'
import { File, FileRelationType } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, getCurseforgeFileUri, getModrinthVersionUri, InstanceModsServiceKey, ModrinthServiceKey, Resource } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { resolveCurseforgeDependies } from '@/util/curseforgeDependencies'
import { resolveModrinthDependencies } from '@/util/modrinth'
import { getCurseforgeRelationType } from '@/util/curseforge'

export interface ProjectMetadata {
  /**
   * The icon of the project
   */
  icon: string
  /**
   * The uri of the project
   */
  uri: string
  /**
   * The name of the project
   */
  name: string
}

export interface InstallListFileItem {
  /**
   * The id of the file. Should be identical.
   */
  id: string
  /**
   * The display name of this item
   */
  name: string
  /**
   * Is this item representing a removing operation
   */
  remove?: boolean
  /**
   * The universal resource identifiers of the item. This is used for detecting duplicated things
   */
  uris: string[]
  /**
   * The project universal identifier
  */
  projectUri: string
  /**
   * The project display name of the mod
   */
  projectName?: string
  /**
   * The icon of the item
   */
  icon?: string
  /**
   * The backed curseforge file
   */
  curseforge?: File
  /**
   * The backed modrinth file
   */
  modrinth?: ProjectVersion
  /**
   * The backed resource
   */
  resource?: Resource

  warnings: Array<{
    reason: 'duplicated' | 'incompatible'
    target: string
  }>

  enabled: boolean
}

export interface InstallListFileItemParent extends InstallListFileItem {
  dependencies: InstallListFileItemLeaf[]
}

export type InstallListFileItemLeaf = InstallListFileItem & {
  type: 'required' | 'optional' | 'embedded' | 'incompatible'
}

export const kInstallList = Symbol('InstallList') as InjectionKey<ReturnType<typeof useInstallList>>

export function useInstallList(instancePath: Ref<string>, mods: Ref<Resource[]>) {
  const { install, uninstall } = useService(InstanceModsServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const { installVersion } = useService(ModrinthServiceKey)

  const list = ref([] as InstallListFileItemParent[])
  const resourcesLookup = computed(() => {
    const dict = {} as Record<string, [string, Resource][]>
    for (const resource of mods.value) {
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

  function getUris(curseforge?: File, modrinth?: ProjectVersion, project?: ProjectMetadata) {
    const lookups = [] as string[]
    if (curseforge) {
      lookups.push(getCurseforgeFileUri(curseforge))
    }
    if (modrinth) {
      lookups.push(getModrinthVersionUri(modrinth))
    }
    if (project?.uri) {
      lookups.push(project.uri)
    }
    return markRaw(lookups)
  }

  function addAsRemove(item: Resource, project: ProjectMetadata) {
    const id = item.path.toString()
    const result: InstallListFileItemParent = {
      id,
      uris: [],
      name: item.fileName,
      icon: project.icon,
      projectUri: project.uri,
      projectName: project.name,

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
    for (const key of result.uris) {
      if (!mutexDict[key]) {
        mutexDict[key] = []
      }
      mutexDict[key].push(result.name)
    }
  }

  async function add(item: File | ProjectVersion | Resource, project: ProjectMetadata) {
    const id = 'path' in item ? item.path : 'project_id' in item ? item.id : item.id.toString()
    // should not add the item twice
    if (list.value.some(v => v.id === id)) return
    // should not add the item in same project
    if (project.name && list.value.some(v => v.projectName === project.name)) return

    const name = 'path' in item ? item.fileName : 'project_id' in item ? item.name : item.displayName.toString()
    const curseforge = 'modId' in item ? item : undefined
    const modrinth = 'project_id' in item ? item : undefined
    const resource = 'path' in item ? item : undefined
    const uris = markRaw(getUris(curseforge, modrinth, project))
    const result: InstallListFileItemParent = {
      id,
      uris,
      name,
      icon: project.icon,
      projectUri: project.uri,
      projectName: project.name,

      curseforge,
      modrinth,
      resource,

      warnings: getWarnings(mutexDict, uris, name),

      enabled: true,
      dependencies: await getDependencies(curseforge, modrinth, resource),
    }

    list.value.push(result)

    // add to mutex dict
    for (const dep of result.dependencies) {
      for (const key of dep.uris) {
        if (!mutexDict[key]) {
          mutexDict[key] = []
        }
        mutexDict[key].push(dep.name)
      }
    }

    for (const key of result.uris) {
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
      for (const key of dep.uris) {
        const index = mutexDict[key].findIndex(i => i === removed.name)
        mutexDict[key].splice(index, 1)
      }
    }

    for (const key of removed.uris) {
      const index = mutexDict[key].findIndex(i => i === removed.name)
      mutexDict[key].splice(index, 1)
    }

    for (const i of list.value) {
      if (i.warnings.length > 0) {
        i.warnings = getWarnings(mutexDict, i.uris, i.name)
        for (const dep of i.dependencies) {
          dep.warnings = getWarnings(mutexDict, dep.uris, dep.name)
        }
      }
    }
  }

  async function getCurseforgeDependencies(curseforge: File) {
    const result = await resolveCurseforgeDependies(curseforge)
    return result.map(([file, type]) => {
      const uris = getUris(file)
      const item: InstallListFileItemLeaf = {
        id: file.id.toString(),
        name: file.displayName,
        projectUri: file.modId.toString(),
        curseforge: file,
        enabled: true,
        type: getCurseforgeRelationType(type),
        warnings: getWarnings(mutexDict, uris, file.displayName),
        uris,
      }
      return item
    })
  }
  async function getModrinthDependencies(modrinth: ProjectVersion) {
    const result = await resolveModrinthDependencies(modrinth)
    return result.map(([ver, type]) => {
      const uris = getUris(undefined, ver)
      const item: InstallListFileItemLeaf = {
        id: ver.id.toString(),
        name: ver.name,
        projectUri: ver.project_id,
        modrinth: ver,
        warnings: getWarnings(mutexDict, uris, ver.name),
        type,
        enabled: type === 'required',
        uris,
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
    const result = [] as InstallListFileItemLeaf[]
    if (resource.metadata.curseforge) {
      const mod = await clientCurseforgeV1.getModFile(resource.metadata.curseforge.projectId, resource.metadata.curseforge.fileId).catch(() => { })
      if (mod) {
        const deps = await getCurseforgeDependencies(mod).catch(() => [])
        result.push(...deps)
      }
    } else if (resource.metadata.modrinth) {
      const version = await clientModrinthV2.getProjectVersion(resource.metadata.modrinth.versionId).catch(() => { })
      if (version) {
        const deps = await getModrinthDependencies(version).catch(() => [])
        result.push(...deps)
      }
    } else {
      const modDeps = getModDependencies(resource).filter(dep => dep.modId !== 'minecraft' && dep.modId !== 'forge' && dep.modId !== 'fabricloader' && dep.modId !== 'fabric' && dep.modId !== 'java')
      for (const dep of modDeps) {
        const resource = getModResourceByDep(dep)
        const uris = getUris(undefined, undefined, undefined).concat(['mod:' + dep.modId])
        const item: InstallListFileItemLeaf = {
          id: dep.modId,
          name: resource?.name || dep.modId,
          projectUri: dep.modId,
          warnings: getWarnings(mutexDict, uris, resource?.name || dep.modId),
          type: 'required',
          enabled: !!resource,
          uris,
        }
        result.push(item)
      }
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
    const toInstallCurseforge: [File, string | undefined][] = []
    const toInstallModrinth: [ProjectVersion, string | undefined][] = []
    for (const i of list.value) {
      if (i.enabled && i.resource && !i.remove) {
        toInstall.push(i.resource)
        for (const dep of i.dependencies) {
          if (dep.enabled && dep.resource) {
            toInstall.push(dep.resource)
          }
        }
      } else if (i.enabled && i.resource && i.remove) {
        toRemove.push(i.resource)
      } else if (i.enabled && i.curseforge) {
        toInstallCurseforge.push([i.curseforge, i.icon])
        for (const dep of i.dependencies) {
          if (dep.enabled && dep.curseforge) {
            toInstallCurseforge.push([dep.curseforge, dep.icon])
          }
        }
      } else if (i.enabled && i.modrinth) {
        toInstallModrinth.push([i.modrinth, i.icon])
        for (const dep of i.dependencies) {
          if (dep.enabled && dep.modrinth) {
            toInstallModrinth.push([dep.modrinth, dep.icon])
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

    try {
      installing.value = true
      console.log(toInstallCurseforge)
      console.log(toInstallModrinth)
      await Promise.all([
        install({ mods: toInstall, path: instancePath.value }).then(() => {
          successedToInstall.push(...toInstall)
        }, (e) => {
          console.error('Fail to install', e)
        }),
        uninstall({ mods: toRemove, path: instancePath.value }).then(() => {
          successedToRemove.push(...toRemove)
        }, (e) => {
          console.error('Fail to uninstall', e)
        }),
        ...toInstallCurseforge.map(([file, icon]) => installFile({
          file,
          icon,
          type: 'mc-mods',
        }).then(() => {
          successedToInstallCurseforge.push(file)
        }, (e) => {
          console.error('Fail to install curseforge', e)
        })),
        ...toInstallModrinth.map(([version, icon]) => installVersion({
          version,
          icon,
          instancePath: instancePath.value,
        }).then(() => {
          successedToInstallModrinth.push(version)
        }, (e) => {
          console.error('Fail to install modrinth', e)
        })),
      ])
    } finally {
      installing.value = false
    }

    // Remove the successed from list
    list.value = list.value.filter(i => {
      if (i.resource && successedToInstall.includes(i.resource)) return false
      if (i.resource && successedToRemove.includes(i.resource)) return false
      if (i.curseforge && successedToInstallCurseforge.includes(i.curseforge)) return false
      if (i.modrinth && successedToInstallModrinth.includes(i.modrinth)) return false
      return true
    })

    if (list.value.length > 0) {
      console.error(`Failed to install ${list.value.length} mods.`)
    }

    for (const key in mutexDict) {
      mutexDict[key] = []
    }
  }

  const installing = ref(false)

  return {
    installing,
    list,
    addAsRemove,
    add,
    remove,
    commit,
  }
}

export function useInstallListProxy(): ReturnType<typeof useInstallList> {
  return {
    list: ref([]),
    addAsRemove: () => { },
    add: async () => { },
    remove: () => { },
    commit: async () => { },
    installing: ref(false),
  }
}
