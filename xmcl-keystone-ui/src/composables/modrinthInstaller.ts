import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { isNoModLoader } from '@/util/isNoModloader'
import { ProjectFile } from '@/util/search'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { InstallMarketOptionWithInstance, MarketType, RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'

export const kModrinthInstaller: InjectionKey<ReturnType<typeof useModrinthInstaller>> = Symbol('modrinthInstaller')

export function useModrinthInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installResource: (options: InstallMarketOptionWithInstance) => void,
  uninstallFiles: (resources: ProjectFile[], path?: string) => void,
) {
  const installDefaultModLoader = useInstanceModLoaderDefault()

  function install(p: Project, v: ProjectVersion, pa?: string) {
    return installResource({
      market: MarketType.Modrinth,
      version: v,
      instancePath: pa || path.value,
      icon: p.icon_url,
    })
  }

  async function installWithDependencies(p: Project, v: ProjectVersion, installed: ProjectFile[], deps: Array<{ recommendedVersion: ProjectVersion; project: Project; type: string }>) {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    if (isNoModLoader(runtime.value)) {
      // forge, fabric, quilt or neoforge
      await installDefaultModLoader(_path, _runtime, v.loaders)
    }
    const files = [...installed]
    await Promise.all(deps
      ?.filter((v) => v.type === 'required')
      .filter(v => _allFiles.every(m => m.modrinth?.projectId !== v.project.id))
      .map((v) => install(v.project, v.recommendedVersion)) ?? [])
    await install(p, v, _path)
    if (files.length > 0) {
      uninstallFiles(files)
    }
  }

  return { installWithDependencies, install }
}
