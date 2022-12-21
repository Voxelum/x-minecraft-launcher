import { Project, ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceAdd'
import { useNotifier } from './notifier'
import { useService } from './service'

export function useModrinthInstall(project: Ref<Project | undefined>, installTo: Ref<string>, getResource: (version: ProjectVersion) => Resource) {
  const { getProject, installVersion } = useService(ModrinthServiceKey)
  const { install } = useService(ResourceServiceKey)
  const { show } = useDialog(AddInstanceDialogKey)
  const { t } = useI18n()

  const { notify } = useNotifier()

  const onInstall = async (version: ProjectVersion) => {
    const resource = getResource(version)
    if (resource) {
      if (resource.domain === ResourceDomain.Modpacks) {
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
  }
}
