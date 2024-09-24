import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { getCursforgeFileModLoaders } from '@/util/curseforge'
import { isNoModLoader } from '@/util/isNoModloader'
import { ProjectFile } from '@/util/search'
import { File, FileRelationType, HashAlgo, Mod } from '@xmcl/curseforge'
import { CurseforgeUpstream, InstallMarketOptionWithInstance, MarketType, Resource, RuntimeVersions, getCurseforgeFileUri } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'

export const kCurseforgeInstaller: InjectionKey<ReturnType<typeof useCurseforgeInstaller>> = Symbol('curseforgeInstaller')

export function useCurseforgeInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installResource: (options: InstallMarketOptionWithInstance) => void,
  uninstallResource: (files: ProjectFile[], path?: string) => void,
  type: 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks',
) {
  const installDefaultModLoader = useInstanceModLoaderDefault()
  const install = async (v: File, icon?: string) => {
    return installResource({
      market: MarketType.CurseForge,
      file: v,
      icon,
      instancePath: path.value,
    })
  }

  const installWithDependencies = async (mod: Mod, file: File, installed: ProjectFile[], deps: Array<{
    type: FileRelationType
    file: File
    files: File[]
    project: Mod
  }>) => {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    if (isNoModLoader(runtime.value)) {
      // forge, fabric, quilt or neoforge
      const loaders = getCursforgeFileModLoaders(file)
      await installDefaultModLoader(_path, _runtime, loaders)
    }

    const toUninstalls = [...installed]
    await Promise.all(deps
      ?.filter((v) => v.type === FileRelationType.RequiredDependency)
      .filter(v => _allFiles.every(m => m.curseforge?.fileId !== v.project.id))
      .map((v) => install(v.file, v.project.logo?.url)) ?? [])
    await install(file, mod.logo.url)
    if (toUninstalls.length > 0) {
      uninstallResource(toUninstalls)
    }
  }

  return {
    installWithDependencies,
    install,
  }
}
