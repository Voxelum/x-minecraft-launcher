import { getFTBTemplateAndFile } from '@/util/ftb'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { CachedFTBModpackVersionManifest, InstanceFile, InstanceManifest, JavaRecord, ModpackInstallProfile, ModpackServiceKey, Peer, Resource } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { useService } from './service'
import { renderMinecraftPlayerTextHead } from '@/util/avatarRenderer'

export type AddInstanceDialogParameter = {
  type: 'resource'
  resource: Resource
} | {
  type: 'ftb'
  manifest: CachedFTBModpackVersionManifest
} | {
  type: 'manifest'
  manifest: InstanceManifest
}

export const AddInstanceDialogKey: DialogKey<AddInstanceDialogParameter> = 'add-instance-dialog'

export interface Template {
  filePath: string
  name: string
  instance: ModpackInstallProfile['instance']
  type: 'curseforge' | 'mcbbs' | 'modpack' | 'modrinth' | 'instance' | 'ftb' | 'peer'
  description: string
  loadFiles: () => Promise<InstanceFile[]>
}

export function useInstanceTemplates(javas: Ref<JavaRecord[]>) {
  const { t } = useI18n()
  const { getModpackInstallFiles } = useService(ModpackServiceKey)

  const getTemplates = (modpackResources: Resource[], peers: Peer[], ftb: CachedFTBModpackVersionManifest[]) => {
    const all = [] as Array<Template>
    for (const resource of modpackResources) {
      const config = resolveModpackInstanceConfig(resource)
      const type = resource.metadata['modrinth-modpack']
        ? 'modrinth'
        : resource.metadata['curseforge-modpack']
          ? 'curseforge'
          : resource.metadata['mcbbs-modpack'] ? 'mcbbs' : 'modpack'
      if (config) {
        let promise: Promise<InstanceFile[]> | undefined
        const result: Template = reactive({
          filePath: resource.path,
          name: config.name,
          instance: markRaw(config),
          description: computed(() => getActionText(type)),
          type,
          loadFiles: () => {
            if (!promise) {
              promise = getModpackInstallFiles(resource.path)
            }
            return promise
          },
        })
        all.push(result)
      }
    }

    for (const c of peers) {
      if (c.sharing) {
        all.push(getPeerTemplate(c.id, c.userInfo.name, c.userInfo.avatar, c.sharing))
      }
    }

    for (const f of ftb) {
      all.push(getFtbTemplate(f))
    }

    return all
  }

  const getActionText = (type: string) => {
    if (type === 'mcbbs') return t('instanceTemplate.mcbbs')
    if (type === 'curseforge') return t('instanceTemplate.curseforge')
    if (type === 'modrinth') return t('instanceTemplate.modrinth')
    return t('instanceTemplate.modpack')
  }

  function getPeerTemplate(id: string, name: string, icon: string, man: InstanceManifest) {
    const result: Template = reactive({
      filePath: id,
      name: `${man.name ?? 'Instance'}@${name}`,
      description: '',
      instance: {
        icon,
        name: `${man.name ?? 'Instance'}@${name}`,
        description: man.description,
        runtime: {
          minecraft: man.runtime.minecraft,
          forge: man.runtime.forge ?? '',
          fabricLoader: man.runtime.fabricLoader ?? '',
          quiltLoader: man.runtime.quiltLoader ?? '',
          optifine: man.runtime.optifine ?? '',
          neoForged: man.runtime.neoForged ?? '',
          yarn: '',
          liteloader: '',
        },
        vmOptions: man.vmOptions,
        mcOptions: man.mcOptions,
        minMemory: man.minMemory,
        maxMemory: man.maxMemory,
      },
      loadFiles: () => Promise.resolve(man.files),
      type: 'peer',
    })

    renderMinecraftPlayerTextHead(icon)?.then((rendered) => {
      result.instance.icon = rendered
    })

    return result
  }

  function getFtbTemplate(man: CachedFTBModpackVersionManifest): Template {
    const [instanceConfig, files] = getFTBTemplateAndFile(man, javas.value)
    return reactive({
      filePath: `${man.parent}-${man.id.toString()}`,
      name: `${man.projectName}-${man.name}`,
      description: computed(() => t('instanceTemplate.ftb')),
      instance: markRaw(instanceConfig),
      loadingFiles: false,
      loadFiles: () => Promise.resolve(files),
      type: 'ftb',
    })
  }

  return {
    getTemplates,
  }
}
