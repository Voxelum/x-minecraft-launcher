import { injection } from '@/util/inject'
import { findInstanceForModpack, InstanceData } from '@xmcl/instance'
import { MarketType, ModpackServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { DialogKey, useDialog } from './dialog'
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

/**
 * Payload for the "update existing instance or create a new one" dialog shown
 * when the modpack being installed already has a corresponding instance.
 */
export interface ModpackUpdateDialogPayload {
  /**
   * The downloaded modpack file path.
   */
  modpackFile: string
  icon?: string
  upstream: InstanceData['upstream']
  /**
   * The path of the existing instance that matches this modpack.
   */
  instancePath: string
  /**
   * The display name of the existing instance (for the prompt text).
   */
  instanceName: string
}

export const ModpackUpdateDialogKey: DialogKey<ModpackUpdateDialogPayload> = 'modpack-update-or-create'

function toUpstream(f: InstallModpackOptions): InstanceData['upstream'] {
  if (f.market === MarketType.CurseForge) {
    return {
      type: 'curseforge-modpack',
      modId: f.modId,
      fileId: f.fileId,
    }
  }
  return {
    type: 'modrinth-modpack',
    projectId: f.projectId,
    versionId: f.versionId,
  }
}

/**
 * Shared logic to finish installing a downloaded modpack file, either into a
 * new instance (when `instancePath` is omitted) or into an existing instance
 * (update). It selects the resulting instance and kicks off the version
 * install.
 */
export function useModpackFinishInstall() {
  const { selectedInstance } = injection(kInstances)
  const { importModpack } = useService(ModpackServiceKey)
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const { getInstanceLock, getInstallInstruction, handleInstallInstruction } = injection(kInstanceVersionInstall)
  const { all } = injection(kJavaContext)
  const { currentRoute, push } = useRouter()

  return async function finishModpackInstall(modpackFile: string, icon: string | undefined, upstream: InstanceData['upstream'], instancePath?: string) {
    const { instancePath: resultPath, version, runtime } = await importModpack(modpackFile, icon, upstream, instancePath)

    selectedInstance.value = resultPath
    if (currentRoute.value.path !== '/') {
      push('/')
    }

    const lock = getInstanceLock(resultPath)
    lock.runExclusive(async () => {
      const resolved = version ? await resolveLocalVersion(version) : undefined
      const instruction = await getInstallInstruction(resultPath, runtime, '', resolved, all.value)
      await handleInstallInstruction(instruction)
    })
  }
}

export function useModpackInstaller() {
  const { instances } = injection(kInstances)
  const { installModapckFromMarket } = useService(ModpackServiceKey)
  const { show: showUpdateDialog } = useDialog(ModpackUpdateDialogKey)
  const finishModpackInstall = useModpackFinishInstall()

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
    const upstream = toUpstream(f)

    // If an instance for this modpack already exists, ask the user whether to
    // update it or create a new one instead of silently creating a duplicate.
    const existing = findInstanceForModpack(instances.value, { upstream })
    if (existing) {
      showUpdateDialog({
        modpackFile,
        icon,
        upstream,
        instancePath: existing.path,
        instanceName: existing.name,
      })
      return
    }

    await finishModpackInstall(modpackFile, icon, upstream)
  }
  return installModpack
}
