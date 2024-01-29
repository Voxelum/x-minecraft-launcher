import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { generateDistinctName } from '@/util/instanceName'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { InstanceInstallServiceKey, InstanceModsServiceKey, InstanceServiceKey, ModpackServiceKey, ModrinthServiceKey, Resource, ResourceDomain, ResourceServiceKey, getModrinthVersionFileUri } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { kInstanceFiles } from './instanceFiles'
import { AddInstanceDialogKey } from './instanceTemplates'
import { InstanceInstallDialog } from './instanceUpdate'
import { kInstanceVersionDiagnose } from './instanceVersionDiagnose'
import { kInstances } from './instances'
import { useNotifier } from './notifier'
import { useService } from './service'

export const kModrinthInstall: InjectionKey<ReturnType<typeof useModrinthInstall>> = Symbol('ModrinthInstall')

export function useModrinthInstallVersion(path: Ref<string>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { install: installMod } = useService(InstanceModsServiceKey)
  const { installVersion } = useService(ModrinthServiceKey)
  const installModrinthVersion = async (v: ProjectVersion, icon?: string) => {
    const resources = await getResourcesByUris(v.files.map(f => getModrinthVersionFileUri({ project_id: v.project_id, filename: f.filename, id: v.id })))
    if (resources.length > 0) {
      await installMod({ mods: resources, path: path.value })
    } else {
      await installVersion({ version: v, icon, instancePath: path.value })
    }
  }
  return installModrinthVersion
}

export function useModrinthInstall(project: Ref<Project | undefined>, tasks: Ref<Record<string, TaskItem>>, installTo: Ref<string>, getResource: (version: ProjectVersion) => Resource | undefined, currentVersionResource: Ref<Resource | undefined>) {
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
          resource,
        })
      } else if (resource.domain === ResourceDomain.Modpacks) {
        show({ type: 'resource', resource })
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
    } else if (project.value) {
      // if (project.value.project_type === 'mod' && installList) {
      //   installList.add(version, {
      //     uri: version.id,
      //     name: project.value?.title,
      //     icon: project.value?.icon_url ?? '',
      //   })
      // } else {
      await installVersion({ version, icon: project.value?.icon_url, instancePath: installTo.value })
      // }
    }
  }

  return {
    onInstall,
    currentVersionResource,
  }
}

export function useModrinthInstallModpack(icon: Ref<string | undefined>) {
  const { instances, selectedInstance } = injection(kInstances)
  const { getModpackInstallFiles } = useService(ModpackServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  const { createInstance } = useService(InstanceServiceKey)
  const { installVersion } = useService(ModrinthServiceKey)
  const { install, mutate } = injection(kInstanceFiles)
  const { fix } = injection(kInstanceVersionDiagnose)
  const { currentRoute, push } = useRouter()
  const installModpack = async (v: ProjectVersion) => {
    const result = await installVersion({ version: v, icon: icon.value })
    const resource = result.resources[0]
    const config = resolveModpackInstanceConfig(resource)

    if (!config) return
    const name = generateDistinctName(config.name, instances.value.map(i => i.name))
    const path = await createInstance({
      ...config,
      name,
    })
    selectedInstance.value = path
    if (currentRoute.path !== '/') {
      push('/')
    }
    const files = await getModpackInstallFiles(resource.path)
    await installInstanceFiles({
      path,
      files,
    }).catch(() => {
      if (selectedInstance.value === path) {
        return install()
      }
    }).finally(() => {
      mutate()
    })
    fix()
  }
  return {
    installModpack,
  }
}
