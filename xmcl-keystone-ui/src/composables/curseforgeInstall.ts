import { File, FileIndex } from '@xmcl/curseforge'
import { CurseForgeServiceKey, getCurseforgeFileUri, ProjectType, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceAdd'
import { InstanceInstallDialog } from './instanceUpdate'
import { useNotifier } from './notifier'
import { useResourceUrisDiscovery } from './resources'
import { useService } from './service'

export const kCurseforgeInstall: InjectionKey<ReturnType<typeof useCurseforgeInstall>> = Symbol('CurseforgeInstall')

export function useCurseforgeInstall(modId: Ref<number>, files: Ref<Pick<File, 'modId' | 'id'>[]>, from: Ref<string | undefined>, type: Ref<ProjectType>, currentFileResource: Ref<Resource | undefined>) {
  const { installFile, getModFile } = useService(CurseForgeServiceKey)
  const { install: installResource } = useService(ResourceServiceKey)
  const { t } = useI18n()
  const { notify } = useNotifier()

  const { show: showAddInstanceDialog } = useDialog(AddInstanceDialogKey)
  const { show: showInstanceUpdateDialog } = useDialog(InstanceInstallDialog)
  const { resources } = useResourceUrisDiscovery(computed(() => files.value.map(getCurseforgeFileUri)))
  const isDownloaded = (file: Pick<File, 'modId' | 'id'>) => {
    return !!resources.value[getCurseforgeFileUri(file)]
  }
  async function install(input: File | FileIndex) {
    const file = 'modId' in input ? input : await getModFile({ fileId: input.fileId, modId: modId.value })
    const resource = resources.value[getCurseforgeFileUri(file)]
    if (resource) {
      if (currentFileResource.value) {
        showInstanceUpdateDialog({
          type: 'curseforge',
          currentResource: currentFileResource.value,
          resource: resource,
        })
      } else if (type.value === 'modpacks') {
        showAddInstanceDialog(resource.path)
      } else if (from.value) {
        installResource({ instancePath: from.value, resource }).then(() => {
          notify({ title: t('installResource.success', { file: resource.fileName }), level: 'success', full: true })
        }, (e) => {
          notify({
            title: t('installResource.fail', { file: resource.fileName }),
            level: 'error',
            body: e.toString(),
            full: true,
          })
        })
      }
    } else {
      await installFile({ file, type: type.value, instancePath: from.value })
    }
  }
  return {
    install,
    resources,
    isDownloaded,
  }
}
