import { injection } from '@/util/inject'
import { InstallMarketOptions, ModpackServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { kJavaContext } from './java'
import { useService } from './service'

export function useModpackInstaller() {
  const { selectedInstance } = injection(kInstances)
  const { importModpack, installModapckFromMarket } = useService(ModpackServiceKey)
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const { getInstanceLock, getInstallInstruction, handleInstallInstruction } = injection(kInstanceVersionInstall)
  const { all } = injection(kJavaContext)
  const { currentRoute, push } = useRouter()
  const installModpack = async (f: InstallMarketOptions) => {
    const [modpackFile] = await installModapckFromMarket(f)
    const { instancePath, version, runtime } = await importModpack(modpackFile)

    selectedInstance.value = instancePath
    if (currentRoute.path !== '/') {
      push('/')
    }

    const lock = getInstanceLock(instancePath)
    lock.write(async () => {
      const resolved = version ? await resolveLocalVersion(version) : undefined
      const instruction = await getInstallInstruction(instancePath, runtime, '', resolved, all.value)
      await handleInstallInstruction(instruction)
    })
  }
  return installModpack
}
