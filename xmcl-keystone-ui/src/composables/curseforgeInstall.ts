import { File } from '@xmcl/curseforge'
import { CurseForgeServiceKey, getCurseforgeFileUrl, ProjectType, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceAdd'
import { useResourceUrisDiscovery } from './resources'
import { useService } from './service'
import { useNotifier } from './notifier'

export function useCurseforgeInstall(files: Ref<File[]>, from: Ref<string | undefined>, type: ProjectType) {
  const { installFile } = useService(CurseForgeServiceKey)
  const { install: installResource } = useService(ResourceServiceKey)
  const { t } = useI18n()
  const { notify } = useNotifier()

  const { show: showAddInstanceDialog } = useDialog(AddInstanceDialogKey)
  const { resources } = useResourceUrisDiscovery(computed(() => files.value.map(getCurseforgeFileUrl)))
  const isDownloaded = (file: File) => {
    return !!resources.value[getCurseforgeFileUrl(file)]
  }
  async function install(file: File) {
    const resource = resources.value[getCurseforgeFileUrl(file)]
    if (resource) {
      if (type === 'modpacks') {
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
      await installFile({ file, type, instancePath: from.value })
    }
  }
  return {
    install,
    resources,
    isDownloaded,
  }
}
