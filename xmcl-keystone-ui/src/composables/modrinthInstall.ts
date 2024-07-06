import { injection } from '@/util/inject'
import { generateDistinctName } from '@/util/instanceName'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { ProjectVersion } from '@xmcl/modrinth'
import { InstanceInstallServiceKey, InstanceServiceKey, ModpackServiceKey, ModrinthServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersionDiagnose } from './instanceVersionDiagnose'
import { kInstances } from './instances'
import { useService } from './service'

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

    if (!resource) throw new Error('NO_RESOURCE')

    const config = resolveModpackInstanceConfig(resource)

    if (!config) throw new Error('NO_MODPACK_CONFIG')
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
