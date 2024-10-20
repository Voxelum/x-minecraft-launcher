import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { ProjectFile } from '@/util/search'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { InstallMarketOptionWithInstance, MarketType, RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'

export const kModrinthInstaller: InjectionKey<ReturnType<typeof useModrinthInstaller>> = Symbol('modrinthInstaller')

export function useModrinthInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installFromMarket: (options: InstallMarketOptionWithInstance) => Promise<any>,
  uninstallFiles: (resources: ProjectFile[], path?: string) => void,
  installDefaultModLoader = useInstanceModLoaderDefault(),
) {
  function install(version: { versionId: string; icon?: string } | { versionId: string; icon?: string }[], instancePath?: string) {
    return installFromMarket({
      market: MarketType.Modrinth,
      version,
      instancePath: instancePath || path.value,
    })
  }

  async function installWithDependencies(versionId: string, loaders: string[], icon: string | undefined, installed: ProjectFile[], deps: Array<{ recommendedVersion: ProjectVersion; project: Project; type: string }>) {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    const success = await installDefaultModLoader(_path, _runtime, loaders)
    if (!success) {
      return false
    }
    const files = [...installed]
    const versions = deps
      ?.filter((v) => v.type === 'required')
      .filter(v => _allFiles.every(m => m.modrinth?.projectId !== v.project.id))
      .map((v) => ({ versionId: v.recommendedVersion.id, icon: v.project.icon_url }))

    versions.push({ versionId, icon })
    await install(versions, _path)
    if (files.length > 0) {
      uninstallFiles(files, _path)
    }
    return true
  }

  return { installWithDependencies, install }
}
