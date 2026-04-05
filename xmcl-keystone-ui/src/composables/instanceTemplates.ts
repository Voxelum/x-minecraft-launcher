import { renderMinecraftPlayerTextHead } from '@/util/avatarRenderer'
import { getFTBTemplateAndFile } from '@/util/ftb'
import type { InstanceFile, ModpackInstallProfile } from '@xmcl/instance'
import { Resource } from '@xmcl/resource'
import { CachedFTBModpackVersionManifest, InstanceManifest, JavaRecord, ModpackServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { useService } from './service'

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

  const getTemplates = (modpackResources: Resource[], ftb: CachedFTBModpackVersionManifest[]) => {
    const all = [] as Array<Template>
    // for (const resource of modpackResources) {
    //   const config = resolveModpackInstanceConfig(resource)
    //   if (config) {
    //     let promise: Promise<InstanceFile[]> | undefined
    //     const result: Template = markRaw({
    //       filePath: resource.path,
    //       name: config.name,
    //       instance: markRaw(config),
    //       loadFiles: () => {
    //         if (!promise) {
    //           promise = openModpack(resource.path).then(state => waitModpackFiles(state))
    //         }
    //         return promise
    //       },
    //     } as Template)
    //     all.push(result)
    //   }
    // }

    for (const f of ftb) {
      all.push(getFtbTemplate(f))
    }

    return all
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
