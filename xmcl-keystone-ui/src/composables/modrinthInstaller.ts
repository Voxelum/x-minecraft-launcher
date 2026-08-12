import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { basename } from '@/util/basename'
import { ProjectFile } from '@/util/search'
import { InstanceFile, RuntimeVersions } from '@xmcl/instance'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { InstallMarketOptionWithInstance, MarketType } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import type { ResolveArtifactModrinthDependencies } from './modArtifactDependencies'
import { getRequiredModrinthInstallVersions } from './modInstall'
import { useMarketInstall } from './marketInstall'

export const kModrinthInstaller: InjectionKey<ReturnType<typeof useModrinthInstaller>> = Symbol('modrinthInstaller')

export function useModrinthInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  resolveFromMarket: (options: InstallMarketOptionWithInstance) => Promise<InstanceFile[]>,
  installDefaultModLoader = useInstanceModLoaderDefault(),
  resolveArtifactDependencies?: ResolveArtifactModrinthDependencies,
) {
  const installFiles = useMarketInstall()

  async function install(version: { versionId: string; icon?: string } | { versionId: string; icon?: string }[], instancePath?: string) {
    const target = instancePath || path.value
    const files = await resolveFromMarket({
      market: MarketType.Modrinth,
      version,
      instancePath: target,
    })
    return installFiles(target, [], files)
  }

  async function installWithDependencies(versionId: string, loaders: string[], icon: string | undefined, installed: ProjectFile[], deps: Array<{ recommendedVersion: ProjectVersion; project: Project; type: string }>, artifactUrl?: string) {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    const success = await installDefaultModLoader(_path, _runtime, loaders)
    if (!success) {
      return false
    }
    const installedProjects = new Set(_allFiles.flatMap(file => file.modrinth ? [file.modrinth.projectId] : []))
    const versions = getRequiredModrinthInstallVersions({ id: versionId, icon }, deps, installedProjects)
    const selectedProjects = new Set(deps.map(dependency => dependency.project.id))
    if (resolveArtifactDependencies) {
      versions.push(...await resolveArtifactDependencies(artifactUrl, selectedProjects, loaders))
    }
    const files = await resolveFromMarket({ market: MarketType.Modrinth, version: versions, instancePath: _path })
    const domain = files[0]?.path.split('/')[0] ?? 'mods'
    const oldFiles = installed.map(file => ({
      path: `${domain}/${basename(file.path)}`,
      hashes: {},
      ...(file.modrinth ? { modrinth: file.modrinth } : {}),
    }))
    await installFiles(_path, oldFiles, files)
    return true
  }

  return { installWithDependencies, install }
}
