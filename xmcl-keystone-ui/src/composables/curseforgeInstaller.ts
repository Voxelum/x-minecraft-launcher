import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { isNoModLoader } from '@/util/isNoModloader'
import { ProjectFile } from '@/util/search'
import { File, FileRelationType, Mod } from '@xmcl/curseforge'
import { InstallMarketOptionWithInstance, MarketType, RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'

export const kCurseforgeInstaller: InjectionKey<ReturnType<typeof useCurseforgeInstaller>> = Symbol('curseforgeInstaller')

export function useCurseforgeInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installResource: (options: InstallMarketOptionWithInstance) => Promise<any>,
  uninstallResource: (files: ProjectFile[], path?: string) => void,
  installDefaultModLoader = useInstanceModLoaderDefault(),
) {
  const install = async (file: { fileId: number; icon?: string } | { fileId: number; icon?: string }[]) => {
    return installResource({
      market: MarketType.CurseForge,
      file,
      instancePath: path.value,
    })
  }

  async function installWithDependencies(fileId: number, loaders: string[], icon: string | undefined, installed: ProjectFile[], deps: Array<{
    type: FileRelationType
    file: File
    files: File[]
    project: Mod
  }>) {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    if (isNoModLoader(runtime.value)) {
      // forge, fabric, quilt or neoforge
      await installDefaultModLoader(_path, _runtime, loaders)
    }

    const toUninstalls = [...installed]
    const files = deps
      ?.filter((v) => v.type === FileRelationType.RequiredDependency)
      .filter(v => _allFiles.every(m => m.curseforge?.fileId !== v.project.id))
      .map((v) => ({
        fileId: v.file.id,
        icon: v.project.logo.url as string | undefined,
      }))

    files.push({ fileId, icon })

    await install(files)

    if (toUninstalls.length > 0) {
      uninstallResource(toUninstalls, _path)
    }
  }

  return {
    installWithDependencies,
    install,
  }
}
