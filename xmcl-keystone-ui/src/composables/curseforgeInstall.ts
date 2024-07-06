import { injection } from '@/util/inject'
import { generateDistinctName } from '@/util/instanceName'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { File, HashAlgo } from '@xmcl/curseforge'
import { CurseForgeServiceKey, CurseforgeUpstream, InstanceInstallServiceKey, InstanceServiceKey, ModpackServiceKey, Resource, ResourceServiceKey, getCurseforgeFileUri } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersionDiagnose } from './instanceVersionDiagnose'
import { kInstances } from './instances'
import { useService } from './service'

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

export function useCurseforgeInstallModpack(icon: Ref<string | undefined>) {
  const { instances, selectedInstance } = injection(kInstances)
  const { getModpackInstallFiles } = useService(ModpackServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  const { createInstance } = useService(InstanceServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const { install, mutate } = injection(kInstanceFiles)
  const { fix } = injection(kInstanceVersionDiagnose)
  const { currentRoute, push } = useRouter()
  const installModpack = async (f: File) => {
    const result = await installFile({ file: f, type: 'modpacks', icon: icon.value })
    const resource = result.resource
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
