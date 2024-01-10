import { clientCurseforgeV1 } from '@/util/clients'
import { injection } from '@/util/inject'
import { generateDistinctName } from '@/util/instanceName'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { File, FileIndex, HashAlgo } from '@xmcl/curseforge'
import { CurseForgeServiceKey, CurseforgeUpstream, InstanceInstallServiceKey, InstanceServiceKey, ModpackServiceKey, ProjectType, Resource, ResourceServiceKey, getCurseforgeFileUri } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { getCurseforgeProjectModel } from './curseforge'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceTemplates'
import { InstanceInstallDialog } from './instanceUpdate'
import { kInstanceVersionDiagnose } from './instanceVersionDiagnose'
import { kInstances } from './instances'
import { useNotifier } from './notifier'
import { useResourceUrisDiscovery } from './resources'
import { useService } from './service'
import { useSWRVModel } from './swrv'
import { kInstanceFiles } from './instanceFiles'
import { kModpackNotification } from './modpackNotification'

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

export function useCurseforgeInstanceResource() {
  const { getResourceByHash, getResourcesByUris } = useService(ResourceServiceKey)
  async function getResourceByUpstream(upstream: CurseforgeUpstream) {
    let resource: Resource | undefined
    if (upstream.sha1) {
      resource = await getResourceByHash(upstream.sha1)
    }
    if (!resource) {
      const arr = await getResourcesByUris([getCurseforgeFileUri({
        modId: upstream.modId,
        id: upstream.fileId,
      })])
      resource = arr[0]
    }
    return resource
  }
  async function getResourceByFile(file: File) {
    let resource: Resource | undefined
    const sha1 = file.hashes.find(f => f.algo === HashAlgo.Sha1)?.value
    if (file && sha1) {
      resource = await getResourceByHash(sha1)
    }
    if (!resource) {
      const arr = await getResourcesByUris([getCurseforgeFileUri(file)])
      resource = arr[0]
    }
    return resource
  }
  return {
    getResourceByUpstream,
    getResourceByFile,
  }
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
  const { data: project } = useSWRVModel(getCurseforgeProjectModel(modId))
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

export function useCurseforgeInstallModpack(icon: Ref<string | undefined>) {
  const { instances, selectedInstance } = injection(kInstances)
  const { getModpackInstallFiles } = useService(ModpackServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  const { createInstance } = useService(InstanceServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const { install, mutate } = injection(kInstanceFiles)
  const { fix } = injection(kInstanceVersionDiagnose)
  const { ignore } = injection(kModpackNotification)
  const { currentRoute, push } = useRouter()
  const installModpack = async (f: File) => {
    const result = await installFile({ file: f, type: 'modpacks', icon: icon.value })
    const resource = result.resource
    ignore(resource.path)
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
    await fix()
  }
  return installModpack
}
