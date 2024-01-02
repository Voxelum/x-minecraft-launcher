import { getCursforgeFileModLoaders } from '@/util/curseforge'
import { isNoModLoader } from '@/util/isNoModloader'
import { File, FileRelationType, Mod } from '@xmcl/curseforge'
import { ResourceServiceKey, CurseForgeServiceKey, getCurseforgeFileUri, RuntimeVersions, Resource } from '@xmcl/runtime-api'
import { useService } from './service'
import { ProjectFile } from '@/util/search'
import { InjectionKey, Ref } from 'vue'
import { useInstanceModLoaderDefault } from '@/util/instanceModLoaderDefault'

export const kCurseforgeInstaller: InjectionKey<ReturnType<typeof useCurseforgeInstaller>> = Symbol('curseforgeInstaller')

export function useCurseforgeInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installResource: (resource: Resource[]) => void,
  uninstallResource: (files: ProjectFile[]) => void,
  type: 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks',
) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const installDefaultModLoader = useInstanceModLoaderDefault(path, runtime)
  const install = async (v: File, icon?: string) => {
    const resources = await getResourcesByUris([getCurseforgeFileUri(v)])
    if (resources.length > 0) {
      installResource(resources)
    } else {
      const { resource } = await installFile({ file: v, icon, type })
      installResource([resource])
    }
  }

  const installWithDependencies = async (mod: Mod, file: File, installed: ProjectFile[], deps: Array<{
    type: FileRelationType
    file: File
    files: File[]
    project: Mod
  }>) => {
    if (isNoModLoader(runtime.value)) {
      // forge, fabric, quilt or neoforge
      const loaders = getCursforgeFileModLoaders(file)
      await installDefaultModLoader(loaders)
    }

    const toUninstalls = [...installed]
    await Promise.all(deps
      ?.filter((v) => v.type === FileRelationType.RequiredDependency)
      .filter(v => allFiles.value.every(m => m.curseforge?.fileId !== v.project.id))
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
