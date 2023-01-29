import { TaskItem } from '@/entities/task'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceAdd'
import { InstanceInstallDialog } from './instanceUpdate'
import { useNotifier } from './notifier'
import { useService } from './service'

export const kModrinthInstall: InjectionKey<ReturnType<typeof useModrinthInstall>> = Symbol('ModrinthInstall')

export function useModrinthInstall(project: Ref<Project | undefined>, tasks: Ref<Record<string, TaskItem>>, installTo: Ref<string>, getResource: (version: ProjectVersion) => Resource, currentVersionResource: Ref<Resource | undefined>) {
  const { installVersion } = useService(ModrinthServiceKey)
  const { install } = useService(ResourceServiceKey)
  const { show: showInstanceUpdateDialog } = useDialog(InstanceInstallDialog)
  const { show } = useDialog(AddInstanceDialogKey)
  const { t } = useI18n()

  const { notify } = useNotifier()

  const onInstall = async (version: ProjectVersion) => {
    // if version is installing, then skip to install
    if (tasks.value[version.id]) return
    const resource = getResource(version)
    if (resource) {
      if (currentVersionResource.value) {
        showInstanceUpdateDialog({
          type: 'modrinth',
          currentResource: currentVersionResource.value,
          resource: resource,
        })
      } else if (resource.domain === ResourceDomain.Modpacks) {
        show(resource.path)
      } else if (installTo.value) {
        install({ resource, instancePath: installTo.value }).then(() => {
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
      await installVersion({ version, instancePath: installTo.value, project: project.value })
    }
  }

  return {
    onInstall,
    currentVersionResource,
  }
}
