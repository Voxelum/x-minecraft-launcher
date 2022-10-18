import { CachedFTBModpackVersionManifest, CurseforgeModpackResource, InstanceData, InstanceSchema, InstanceServiceKey, isCurseforgeModpackResource, isModrinthModpackResource, isMcbbsModpackResource, JavaServiceKey, McbbsModpackResource, ModpackResource, ModrinthModpackResource, RawModpackResource, ResourceDomain, ResourceServiceKey, ResourceType, RuntimeVersions, getInstanceConfigFromModrinthModpack, getInstanceConfigFromCurseforgeModpack, getInstanceConfigFromMcbbsModpack } from '@xmcl/runtime-api'
import { DialogKey } from './dialog'
import { useFeedTheBeastVersionsCache } from './ftb'
import { useService } from '@/composables'

export const AddInstanceDialogKey: DialogKey<string> = 'add-instance-dialog'

export interface Template extends Partial<InstanceData> {
  id: string
  name: string
  runtime: Required<RuntimeVersions>
  source: TemplateSource
}

export type TemplateSource = {
  type: 'curseforge'
  resource: CurseforgeModpackResource
} | {
  type: 'mcbbs'
  resource: McbbsModpackResource
} | {
  type: 'modpack'
  resource: ModpackResource
} | {
  type: 'modrinth'
  resource: ModrinthModpackResource
} | {
  type: 'instance'
  instance: InstanceSchema
} | {
  type: 'ftb'
  manifest: CachedFTBModpackVersionManifest
}

export function useAllTemplate(data: InstanceData) {
  const { state: resourceState } = useService(ResourceServiceKey)
  const { state: javaState } = useService(JavaServiceKey)

  const { refresh, refreshing, cache: ftb, dispose } = useFeedTheBeastVersionsCache()

  const allTemplates = computed(() => {
    const all = [] as Array<Template>
    all.push(...resourceState.modpacks.map((modpack) => {
      if (isCurseforgeModpackResource(modpack)) {
        return getCurseforgeTemplate(modpack)
      } else if (isMcbbsModpackResource(modpack)) {
        return getMcbbsTemplate(modpack)
      } else if (isModrinthModpackResource(modpack)) {
        return getModrinthTemplate(modpack)
      } else {
        return getModpackTemplate(modpack)
      }
    }))
    all.push(...ftb.value.filter(f => f.name && f.targets).map(getFtbTemplate))
    return all
  })

  function getModrinthTemplate(modrinth: ModrinthModpackResource): Template {
    const config = getInstanceConfigFromModrinthModpack(modrinth.metadata['modrinth-modpack'])
    const result: Template = {
      id: modrinth.path,
      name: config.name,
      description: config.description ?? '',
      modpackVersion: config.modpackVersion,
      runtime: {
        minecraft: config.runtime.minecraft,
        forge: config.runtime.forge ?? '',
        fabricLoader: config.runtime.fabricLoader ?? '',
        quiltLoader: config.runtime.quiltLoader ?? '',
        optifine: '',
        yarn: '',
        liteloader: '',
      },
      icon: modrinth.icons?.[0],
      source: { type: 'modrinth', resource: modrinth },
    }

    if (modrinth.metadata.modrinth) {
      result.upstream = {
        type: 'modrinth-modpack',
        projectId: modrinth.metadata.modrinth.projectId,
        versionId: modrinth.metadata.modrinth.versionId,
      }
    }

    return result
  }

  function getCurseforgeTemplate(curseforge: CurseforgeModpackResource): Template {
    const config = getInstanceConfigFromCurseforgeModpack(curseforge.metadata['curseforge-modpack'])
    const result: Template = {
      id: curseforge.path,
      name: config.name,
      author: config.author,
      modpackVersion: config.modpackVersion,
      runtime: {
        minecraft: config.runtime.minecraft,
        forge: config.runtime.forge ?? '',
        quiltLoader: '',
        fabricLoader: config.runtime.fabricLoader ?? '',
        liteloader: '',
        yarn: '',
        optifine: '',
      },
      source: { type: 'curseforge', resource: curseforge },
      icon: curseforge.icons?.[0],
    }

    if (curseforge.metadata.curseforge) {
      result.upstream = {
        type: 'curseforge-modpack',
        modId: curseforge.metadata.curseforge.projectId,
        fileId: curseforge.metadata.curseforge.fileId,
        sha1: curseforge.hash,
      }
    }

    return result
  }

  function getMcbbsTemplate(res: McbbsModpackResource): Template {
    const config = getInstanceConfigFromMcbbsModpack(res.metadata['mcbbs-modpack'])
    const result: Template = {
      id: res.path,
      name: config.name,
      author: config.author,
      description: config.description,
      runtime: {
        minecraft: config.runtime.minecraft,
        forge: config.runtime.forge,
        fabricLoader: config.runtime.fabricLoader,
        quiltLoader: '',
        liteloader: '',
        yarn: '',
        optifine: '',
      },
      vmOptions: config.vmOptions,
      mcOptions: config.mcOptions,
      minMemory: config.minMemory,
      icon: res.icons?.[0],
      source: { type: 'mcbbs', resource: res },
    }

    return result
  }

  function getFtbTemplate(f: CachedFTBModpackVersionManifest): Template {
    const getVersion = (str?: string) => {
      if (!str) { return undefined }
      const match = /(\d+)\.(\d)+\.(\d+)(_\d+)?/.exec(str)
      if (match === null) { return undefined }
      if (match[1] === '1') {
        return {
          version: str,
          majorVersion: Number.parseInt(match[2]),
          patch: Number.parseInt(match[4].substring(1)),
        }
      }
      return {
        version: str,
        majorVersion: Number.parseInt(match[1]),
        patch: Number.parseInt(match[3]),
      }
    }

    const getRuntime = () => {
      const javaRuntime = f.targets.find(v => v.name === 'java')
      if (javaRuntime) {
        const parsedVersion = getVersion(javaRuntime.version)
        if (!parsedVersion) {
          return
        }
        const majorMatched = javaState.all.filter(v => v.majorVersion === parsedVersion.majorVersion)
        let selectedRecord = majorMatched[0]
        for (const v of majorMatched.slice(1)) {
          const currentPatch = getVersion(v.version)?.patch
          const selectedPatch = getVersion(selectedRecord.version)?.patch
          if (!currentPatch || !selectedPatch) continue
          const diff = Math.abs(currentPatch - parsedVersion.patch)
          const selectedDiff = Math.abs(selectedPatch - parsedVersion.patch)
          if (diff < selectedDiff) {
            selectedRecord = v
          }
        }
        if (selectedRecord) {
          return selectedRecord.path
        }
      }
    }

    return {
      id: `${f.parent}-${f.id.toString()}`,
      name: `${f.projectName}-${f.name}`,
      author: f.authors[0].name,
      java: getRuntime() ?? '',
      runtime: {
        minecraft: f.targets.find(f => f.name === 'minecraft')?.version || '',
        forge: f.targets.find(f => f.name === 'forge')?.version || '',
        fabricLoader: '',
        quiltLoader: '',
        optifine: '',
        liteloader: '',
        yarn: '',
      },
      upstream: {
        type: 'ftb-modpack',
        id: f.id,
      },
      icon: f.iconUrl,
      source: { type: 'ftb', manifest: f },
    }
  }

  function getModpackTemplate(modpack: RawModpackResource): Template {
    return {
      id: modpack.path,
      name: modpack.name,
      runtime: {
        minecraft: modpack.metadata.modpack.runtime.minecraft || '',
        forge: modpack.metadata.modpack.runtime.forge || '',
        fabricLoader: modpack.metadata.modpack.runtime.fabricLoader || '',
        quiltLoader: modpack.metadata.modpack.runtime.quiltLoader || '',
        optifine: modpack.metadata.modpack.runtime.optifine || '',
        liteloader: modpack.metadata.modpack.runtime.liteloader || '',
        yarn: modpack.metadata.modpack.runtime.yarn || '',
      },
      source: {
        type: 'modpack',
        resource: modpack,
      },
    }
  }

  function apply(template: Template) {
    data.name = template.name
    data.runtime = { ...template.runtime }
    data.java = template.java ?? ''
    data.showLog = template.showLog ?? false
    data.hideLauncher = template.hideLauncher ?? true
    data.vmOptions = [...template.vmOptions ?? []]
    data.mcOptions = [...template.mcOptions ?? []]
    data.maxMemory = template.maxMemory ?? 0
    data.minMemory = template.minMemory ?? 0
    data.author = template.author ?? ''
    data.description = template.description ?? ''
    data.url = template.url ?? ''
    data.icon = template.icon ?? ''
    data.modpackVersion = template.modpackVersion || ''
    data.server = template.server ? { ...template.server } : null
    data.upstream = template.upstream
  }

  return {
    templates: allTemplates,
    refresh,
    dispose,
    apply,
    refreshing,
  }
}
