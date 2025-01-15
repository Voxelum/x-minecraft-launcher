import { injection } from '@/util/inject'
import { InstallMarketOptions, InstanceData, MarketType, ModpackServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { kJavaContext } from './java'
import { useService } from './service'

export type InstallModpackOptions = {
  market: MarketType.CurseForge
  modId: number
  fileId: number
  icon?: string
} | {
  market: MarketType.Modrinth
  projectId: string
  versionId: string
  icon?: string
}

export function useModpackInstaller() {
  const { selectedInstance } = injection(kInstances)
  const { importModpack, installModapckFromMarket } = useService(ModpackServiceKey)
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const { getInstanceLock, getInstallInstruction, handleInstallInstruction } = injection(kInstanceVersionInstall)
  const { all } = injection(kJavaContext)
  const { currentRoute, push } = useRouter()
  const installModpack = async (f: InstallModpackOptions) => {
    const [modpackFile] = await installModapckFromMarket(f.market === MarketType.CurseForge
      ? {
        market: MarketType.CurseForge,
        file: { fileId: f.fileId, icon: f.icon },
      }
      : {
        market: MarketType.Modrinth,
        version: { versionId: f.versionId, icon: f.icon },
      })
    const icon = f.icon
    let upstream: InstanceData['upstream']
    if (f.market === MarketType.CurseForge) {
      upstream = {
        type: 'curseforge-modpack',
        modId: f.modId,
        fileId: f.fileId,
      }
    } else {
      upstream = {
        type: 'modrinth-modpack',
        projectId: f.projectId,
        versionId: f.versionId,
      }
    }
    const { instancePath, version, runtime } = await importModpack(modpackFile, icon, upstream)

    selectedInstance.value = instancePath
    if (currentRoute.path !== '/') {
      push('/')
    }

    const lock = getInstanceLock(instancePath)
    lock.runExclusive(async () => {
      const resolved = version ? await resolveLocalVersion(version) : undefined
      const instruction = await getInstallInstruction(instancePath, runtime, '', resolved, all.value)
      await handleInstallInstruction(instruction)
    })
  }
  return installModpack
}
