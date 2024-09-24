import { injection } from '@/util/inject'
import { generateDistinctName } from '@/util/instanceName'
import { CreateInstanceOption, InstallMarketOptions, InstanceServiceKey, ModpackServiceKey, waitModpackFiles } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersion } from './instanceVersion'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { kJavaContext } from './java'
import { useService } from './service'

export function useModpackInstaller(icon: Ref<string | undefined>) {
  const { instances, selectedInstance } = injection(kInstances)
  const { openModpack, installModapckFromMarket } = useService(ModpackServiceKey)
  const { createInstance } = useService(InstanceServiceKey)
  const { installFiles } = injection(kInstanceFiles)
  const { getVersionHeader, getResolvedVersion } = injection(kInstanceVersion)
  const { getInstanceLock, getInstallInstruction, handleInstallInstruction } = injection(kInstanceVersionInstall)
  const { all } = injection(kJavaContext)
  const { currentRoute, push } = useRouter()
  const installModpack = async (f: InstallMarketOptions) => {
    const modpackFile = await installModapckFromMarket({ ...f, icon: icon.value })
    const openedModpack = await openModpack(modpackFile)
    const config = openedModpack.config

    if (!config) return
    const name = generateDistinctName(config.name, instances.value.map(i => i.name))
    const existed = getVersionHeader(config.runtime, '')
    const options: CreateInstanceOption = {
      ...config,
      name,
    }
    if (existed) {
      options.version = existed.id
    }
    const path = await createInstance(options)

    selectedInstance.value = path
    if (currentRoute.path !== '/') {
      push('/')
    }

    waitModpackFiles(openedModpack).then((files) => {
      installFiles(path, files)
    })

    const lock = getInstanceLock(path)
    lock.write(async () => {
      const resolved = existed ? await getResolvedVersion(existed) : undefined
      const instruction = await getInstallInstruction(path, config.runtime, '', resolved, all.value)
      await handleInstallInstruction(instruction)
    })
  }
  return installModpack
}
