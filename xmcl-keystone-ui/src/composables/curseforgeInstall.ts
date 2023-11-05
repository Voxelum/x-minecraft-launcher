import { clientCurseforgeV1 } from '@/util/clients'
import { File, FileIndex } from '@xmcl/curseforge'
import { CurseForgeServiceKey, InstanceModsServiceKey, ProjectType, Resource, ResourceServiceKey, getCurseforgeFileUri } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useCurseforgeProject } from './curseforge'
import { useDialog } from './dialog'
import { kInstallList } from './installList'
import { AddInstanceDialogKey } from './instanceTemplates'
import { InstanceInstallDialog } from './instanceUpdate'
import { useNotifier } from './notifier'
import { useResourceUrisDiscovery } from './resources'
import { useService } from './service'

export const kCurseforgeInstall: InjectionKey<ReturnType<typeof useCurseforgeInstall>> = Symbol('CurseforgeInstall')

export function useCurseforgeInstallModFile(path: Ref<string>, install: (r: Resource[]) => void) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const installCurseforgeFile = async (v: File, icon?: string) => {
    const resources = await getResourcesByUris([getCurseforgeFileUri(v)])
    if (resources.length > 0) {
      install(resources)
    } else {
      const { resource } = await installFile({ file: v, icon, type: 'mc-mods', instancePath: path.value })
      install([resource])
    }
  }
  return installCurseforgeFile
}

export function useCurseforgeInstall(modId: Ref<number>, files: Ref<Pick<File, 'modId' | 'id'>[]>, from: Ref<string | undefined>, type: Ref<ProjectType>, currentFileResource: Ref<Resource | undefined>) {
  const { install: installResource } = useService(ResourceServiceKey)
  const { t } = useI18n()
  const { notify } = useNotifier()
  const { installFile } = useService(CurseForgeServiceKey)

  const { show: showAddInstanceDialog } = useDialog(AddInstanceDialogKey)
  const { show: showInstanceUpdateDialog } = useDialog(InstanceInstallDialog)
  const { resources } = useResourceUrisDiscovery(computed(() => files.value.map(getCurseforgeFileUri)))
  const isDownloaded = (file: Pick<File, 'modId' | 'id'>) => {
    return !!resources.value[getCurseforgeFileUri(file)]
  }
  const { project } = useCurseforgeProject(modId)
  async function install(input: File | FileIndex) {
    const file = 'modId' in input ? input : await clientCurseforgeV1.getModFile(modId.value, input.fileId)
    const resource = resources.value[getCurseforgeFileUri(file)]
    if (resource) {
      if (currentFileResource.value) {
        showInstanceUpdateDialog({
          type: 'curseforge',
          currentResource: currentFileResource.value,
          resource,
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
      await installFile({ file, type: type.value, icon: project.value?.logo.url, instancePath: from.value })
    }
  }
  return {
    install,
    resources,
    isDownloaded,
  }
}
