import { getFTBTemplateAndFile } from '@/util/ftb'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { CachedFTBModpackVersionManifest, InstanceFile, InstanceManifest, JavaRecord, ModpackInstallProfile, ModpackServiceKey, Peer, Resource, waitModpackFiles } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { useService } from './service'
import { renderMinecraftPlayerTextHead } from '@/util/avatarRenderer'

export type AddInstanceDialogParameter = {
  format: 'ftb'
  manifest: CachedFTBModpackVersionManifest
} | {
  format: 'manifest'
  manifest: InstanceManifest
} | {
  format: 'modpack'
  path: string
}

export const AddInstanceDialogKey: DialogKey<AddInstanceDialogParameter> = 'add-instance-dialog'

export interface Template {
  filePath: string
  name: string
  instance: ModpackInstallProfile['instance']
  loadFiles: () => Promise<InstanceFile[]>
}

export function useInstanceTemplates(javas: Ref<JavaRecord[]>) {
  const { t } = useI18n()
  const { openModpack } = useService(ModpackServiceKey)

  const getTemplates = (modpackResources: Resource[], peers: Peer[], ftb: CachedFTBModpackVersionManifest[]) => {
    const all = [] as Array<Template>
    for (const resource of modpackResources) {
      const config = resolveModpackInstanceConfig(resource)
      if (config) {
        let promise: Promise<InstanceFile[]> | undefined
        const result: Template = markRaw({
          filePath: resource.path,
          name: config.name,
          instance: markRaw(config),
          loadFiles: () => {
            if (!promise) {
              promise = openModpack(resource.path).then(state => waitModpackFiles(state))
            }
            return promise
          },
        } as Template)
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

  function getPeerTemplate(id: string, name: string, icon: string, man: InstanceManifest) {
    const result: Template = markRaw({
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
      loadFiles: () => Promise.resolve(markRaw(man.files.map(markRaw))),
      type: 'peer',
    })

    renderMinecraftPlayerTextHead(icon)?.then((rendered) => {
      result.instance.icon = rendered
    })

    return result
  }

  function getFtbTemplate(man: CachedFTBModpackVersionManifest): Template {
    const [instanceConfig, files] = getFTBTemplateAndFile(man, javas.value)
    return markRaw({
      filePath: `${man.parent}-${man.id.toString()}`,
      name: `${man.projectName}-${man.name}`,
      description: t('instanceTemplate.ftb'),
      instance: markRaw(instanceConfig),
      loadFiles: () => Promise.resolve(markRaw(files.map(markRaw))),
      type: 'ftb',
    })
  }

  return {
    getTemplates,
  }
}
