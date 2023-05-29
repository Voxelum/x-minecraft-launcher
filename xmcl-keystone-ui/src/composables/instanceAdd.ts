import { useRefreshable, useService } from '@/composables'
import { getFTBPath } from '@/util/ftb'
import { CachedFTBModpackVersionManifest, InstanceManifest, JavaRecord, ModpackInstallProfile, ModpackServiceKey, PeerConnection, PeerServiceKey, Resource } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'

export const AddInstanceDialogKey: DialogKey<string> = 'add-instance-dialog'

export interface Template extends ModpackInstallProfile {
  filePath: string
  name: string
  type: 'curseforge' | 'mcbbs' | 'modpack' | 'modrinth' | 'instance' | 'ftb' | 'peer'
  description: string
}

export function useAllTemplate(javas: Ref<JavaRecord[]>, modpackResources: Ref<Resource[]>, peers: Ref<PeerConnection[]>) {
  const { t } = useI18n()
  const { getModpackInstallProfile } = useService(ModpackServiceKey)

  const templates = shallowRef([] as Array<Template>)

  const getResourceInstallProfile = async (modpack: Resource): Promise<ModpackInstallProfile> => {
    if (modpack.metadata.instance) {
      return modpack.metadata.instance
    }

    return await getModpackInstallProfile(modpack.path)
  }

  const getActionText = (type: string) => {
    // if (type === 'instance') {
    //   return template.source.instance.server ? t('instanceTemplate.server') : t('instanceTemplate.profile')
    // }
    if (type === 'mcbbs') return t('instanceTemplate.mcbbs')
    if (type === 'curseforge') return t('instanceTemplate.curseforge')
    if (type === 'modrinth') return t('instanceTemplate.modrinth')
    return t('instanceTemplate.modpack')
  }

  const { refresh, refreshing } = useRefreshable(async () => {
    const all = [] as Array<Template>

    const profiles = await Promise.all(modpackResources.value.map(getResourceInstallProfile))

    for (const [i, profile] of profiles.entries()) {
      const modpack = modpackResources.value[i]
      const type = modpack.metadata['modrinth-modpack']
      ? 'modrinth'
      : modpack.metadata['curseforge-modpack']
        ? 'curseforge'
        : modpack.metadata['mcbbs-modpack'] ? 'mcbbs' : 'modpack'
      const result: Template = reactive({
        filePath: modpack.path,
        name: profile.instance.name,
        instance: markRaw(profile.instance),
        files: markRaw(profile.files),
        description: computed(() => getActionText(type)),
        type: modpack.metadata['modrinth-modpack']
          ? 'modrinth'
          : modpack.metadata['curseforge-modpack']
            ? 'curseforge'
            : modpack.metadata['mcbbs-modpack'] ? 'mcbbs' : 'modpack',
      })
      all.push(result)
    }

    for (const c of peers.value) {
      if (c.sharing) {
        all.push(getPeerTemplate(c.id, c.userInfo.name, c.sharing))
      }
    }
    templates.value = all
  })

  // watch([modpackResources, peers], () => {
  //   refresh()
  // })

  function getPeerTemplate(id: string, name: string, man: InstanceManifest) {
    const result: Template = {
      filePath: id,
      name: `${man.name ?? 'Instance'}@${name}`,
      description: '',
      instance: {
        name: `${man.name ?? 'Instance'}@${name}`,
        description: man.description,
        runtime: {
          minecraft: man.runtime.minecraft,
          forge: man.runtime.forge ?? '',
          fabricLoader: man.runtime.fabricLoader ?? '',
          quiltLoader: man.runtime.quiltLoader ?? '',
          optifine: man.runtime.optifine ?? '',
          yarn: '',
          liteloader: '',
        },
        vmOptions: man.vmOptions,
        mcOptions: man.mcOptions,
        minMemory: man.minMemory,
        maxMemory: man.maxMemory,
      },
      files: man.files,
      type: 'peer',
      // source: { type: 'peer', id, manifest: man },
    }

    return result
  }

  function getFtbTemplate(man: CachedFTBModpackVersionManifest): Template {
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
      const javaRuntime = man.targets.find(v => v.name === 'java')
      if (javaRuntime) {
        const parsedVersion = getVersion(javaRuntime.version)
        if (!parsedVersion) {
          return
        }
        const majorMatched = javas.value.filter(v => v.majorVersion === parsedVersion.majorVersion)
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
    const runtime = {
      minecraft: man.targets.find(f => f.name === 'minecraft')?.version || '',
      forge: man.targets.find(f => f.name === 'forge')?.version || '',
      fabricLoader: '',
      quiltLoader: '',
      optifine: '',
      liteloader: '',
      yarn: '',
    }
    return reactive({
      filePath: `${man.parent}-${man.id.toString()}`,
      name: '',
      description: computed(() => t('instanceTemplate.ftb')),
      instance: markRaw({
        name: `${man.projectName}-${man.name}`,
        author: man.authors[0].name,
        java: getRuntime() ?? '',
        runtime,
        upstream: {
          type: 'ftb-modpack',
          id: man.id,
        },
        icon: man.iconUrl,
      }),
      files: markRaw(man.files.map(f => ({
        path: getFTBPath(f),
        hashes: {
          sha1: f.sha1,
        },
        curseforge: f.curseforge
          ? {
            projectId: f.curseforge.project,
            fileId: f.curseforge.file,
          }
          : undefined,
        downloads: f.url ? [f.url] : undefined,
        size: f.size,
      }))),
      type: 'ftb',
    })
  }

  return {
    templates,
    refresh,
    refreshing,
  }
}
