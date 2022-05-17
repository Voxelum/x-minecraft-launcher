import { Ref } from '@vue/composition-api'
import { CachedFTBModpackVersionManifest, CurseforgeModpackResource, FeedTheBeastServiceKey, FTBModpackVersionManifest, InstanceData, InstanceSchema, InstanceServiceKey, JavaServiceKey, McbbsModpackResource, ModpackResource, ResourceServiceKey, ResourceType } from '@xmcl/runtime-api'
import { DialogKey } from './dialog'
import { useRefreshable, useService } from '/@/composables'

export const AddInstanceDialogKey: DialogKey<string> = 'add-instance-dialog'

export interface Template {
  id: string
  name: string
  minecraft: string
  forge: string
  fabric: string
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
  type: 'instance'
  instance: InstanceSchema
} | {
  type: 'ftb'
  manifest: CachedFTBModpackVersionManifest
}

export function useAllTemplate(data: InstanceData) {
  const { state } = useService(InstanceServiceKey)
  const { state: resourceState } = useService(ResourceServiceKey)
  const { getAllCachedModpackVersions } = useService(FeedTheBeastServiceKey)
  const { state: javaState } = useService(JavaServiceKey)

  const ftb: Ref<CachedFTBModpackVersionManifest[]> = ref([])

  const { refresh, refreshing } = useRefreshable(async () => {
    ftb.value = await getAllCachedModpackVersions()
  })
  function dispose() {
    ftb.value = []
  }

  const allTemplates = computed(() => {
    const all = [] as Array<Template>
    all.push(...state.instances.map((instance) => ({
      id: instance.path,
      name: instance.name || `Minecraft ${instance.runtime.minecraft}`,
      minecraft: instance.runtime.minecraft,
      forge: instance.runtime.forge ?? '',
      fabric: instance.runtime.fabricLoader ?? '',
      source: { type: 'instance', instance },
    }) as Template))
    all.push(...resourceState.modpacks.map((modpack) => {
      if (modpack.type === ResourceType.CurseforgeModpack) {
        return getCurseforgeTemplate(modpack)
      } else if (modpack.type === ResourceType.McbbsModpack) {
        return getMcbbsTemplate(modpack)
      } else {
        return getModpackTemplate(modpack)
      }
    }))
    all.push(...ftb.value.filter(f => f.name && f.targets).map(f => {
      return {
        id: `${f.parent}-${f.id.toString()}`,
        name: `${f.projectName}-${f.name}`,
        minecraft: f.targets.find(f => f.name === 'minecraft')?.version || '',
        forge: f.targets.find(f => f.name === 'forge')?.version || '',
        fabric: '',
        source: { type: 'ftb', manifest: f },
      } as Template
    }))
    return all
  })

  function getCurseforgeTemplate(curseforge: CurseforgeModpackResource): Template {
    const result: Template = {
      id: curseforge.path,
      name: `${curseforge.metadata.name}-${curseforge.metadata.version}`,
      minecraft: curseforge.metadata.minecraft.version,
      forge: '',
      fabric: '',
      source: { type: 'curseforge', resource: curseforge },
    }

    const forgeId = curseforge.metadata.minecraft.modLoaders.find(l => l.id.startsWith('forge'))
    const fabricId = curseforge.metadata.minecraft.modLoaders.find(l => l.id.startsWith('fabric'))

    result.forge = forgeId ? forgeId.id.substring(6) : result.forge
    result.fabric = fabricId ? fabricId.id.substring(6) : result.fabric

    return result
  }

  function getMcbbsTemplate(res: McbbsModpackResource): Template {
    const result: Template = {
      id: res.path,
      name: `${res.metadata.name}-${res.metadata.version}`,
      minecraft: res.metadata.addons.find(a => a.id === 'minecraft')?.version ?? '',
      forge: res.metadata.addons.find(a => a.id === 'forge')?.version ?? '',
      fabric: res.metadata.addons.find(a => a.id === 'fabric')?.version ?? '',
      source: { type: 'mcbbs', resource: res },
    }
    return result
  }

  function getModpackTemplate(modpack: ModpackResource): Template {
    return {
      id: modpack.path,
      name: modpack.name,
      minecraft: modpack.metadata.runtime.minecraft,
      forge: modpack.metadata.runtime.forge ?? '',
      fabric: modpack.metadata.runtime.fabricLoader ?? '',
      source: {
        type: 'modpack',
        resource: modpack,
      },
    }
  }

  function applyInstanceTemplate(instance: InstanceData) {
    data.name = instance.name
    data.runtime = { ...instance.runtime }
    data.java = instance.java
    data.showLog = instance.showLog
    data.hideLauncher = instance.hideLauncher
    data.vmOptions = [...instance.vmOptions]
    data.mcOptions = [...instance.mcOptions]
    data.maxMemory = instance.maxMemory
    data.minMemory = instance.minMemory
    data.author = instance.author
    data.description = instance.description
    data.url = instance.url
    data.icon = instance.icon
    data.server = instance.server ? { ...instance.server } : null
  }

  function applyCurseforge(template: Template, resource: CurseforgeModpackResource) {
    const metadata = resource.metadata
    data.name = template.name
    data.runtime.minecraft = template.minecraft
    data.runtime.forge = template.forge
    data.runtime.fabricLoader = template.fabric
    data.author = metadata.author
  }

  function applyMcbbs(template: Template, resource: McbbsModpackResource) {
    const metadata = resource.metadata
    data.name = template.name
    data.runtime.minecraft = template.minecraft
    data.runtime.forge = template.forge
    data.runtime.fabricLoader = template.fabric
    data.author = metadata.author
    if (metadata.launchInfo) {
      if (metadata.launchInfo.javaArgument) {
        data.vmOptions = metadata.launchInfo.javaArgument
      }
      if (metadata.launchInfo.launchArgument) {
        data.mcOptions = metadata.launchInfo.launchArgument
      }
      if (metadata.launchInfo.minMemory) {
        data.minMemory = metadata.launchInfo.minMemory
      }
    }
    data.description = metadata.description
    data.version = metadata.version
  }

  function applyModpack(resource: ModpackResource) {
    const metadata = resource.metadata
    data.name = resource.name
    data.runtime.minecraft = metadata.runtime.minecraft
    data.runtime.forge = metadata.runtime.forge
    data.runtime.fabricLoader = metadata.runtime.fabricLoader
  }

  function applyFTB(template: Template, manifest: CachedFTBModpackVersionManifest) {
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

    data.name = template.name
    data.author = manifest.authors[0].name
    data.runtime.minecraft = template.minecraft
    data.runtime.forge = template.forge
    data.runtime.fabricLoader = template.fabric
    const javaRuntime = manifest.targets.find(v => v.name === 'java')
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
        data.java = selectedRecord.path
      }
    }
    // console.log(manifest.targets.find(v => v.name === 'java'))
  }

  function apply(template: Template) {
    if (template.source.type === 'instance') {
      applyInstanceTemplate(template.source.instance)
    } else if (template.source.type === 'curseforge') {
      applyCurseforge(template, template.source.resource)
    } else if (template.source.type === 'mcbbs') {
      applyMcbbs(template, template.source.resource)
    } else if (template.source.type === 'modpack') {
      applyModpack(template.source.resource)
    } else if (template.source.type === 'ftb') {
      applyFTB(template, template.source.manifest)
    }
  }

  return {
    templates: allTemplates,
    refresh,
    dispose,
    apply,
    refreshing,
  }
}
