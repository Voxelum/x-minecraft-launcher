import { injection } from '@/util/inject'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstanceVersion } from './instanceVersion'
import { InstallServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'
import { kInstance } from './instance'

export function useInstanceVersionServerInstall() {
  const { runtime, path } = injection(kInstance)
  const { installDependencies, installMinecraftJar } = useService(InstallServiceKey)
  const { serverVersionId } = injection(kInstanceVersion)
  const { installServer } = injection(kInstanceVersionInstall)
  async function install() {
    const instPath = path.value
    const runtimeValue = runtime.value
    let version = serverVersionId.value
    if (!version) {
      console.log('installServer')
      const versionIdToInstall = await installServer(runtimeValue, instPath)
      await installMinecraftJar(runtimeValue.minecraft, 'server')
      await installDependencies(versionIdToInstall, 'server')
      version = versionIdToInstall
    } else {
      console.log('installDependencies')
      await installMinecraftJar(runtimeValue.minecraft, 'server')
      await installDependencies(version, 'server')
    }
    return version
  }

  return {
    install,
  }
}
