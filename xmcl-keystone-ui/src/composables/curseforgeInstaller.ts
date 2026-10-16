import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { basename } from '@/util/basename'
import { isNoModLoader } from '@/util/isNoModloader'
import { ProjectFile } from '@/util/search'
import { File, FileRelationType, Mod } from '@xmcl/curseforge'
import { InstanceFile, RuntimeVersions } from '@xmcl/instance'
import { InstallMarketOptionWithInstance, MarketType } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import type { ResolveArtifactModrinthDependencies } from './modArtifactDependencies'
import { getRequiredCurseforgeInstallFiles } from './modInstall'
import { useMarketInstall } from './marketInstall'

export const kCurseforgeInstaller: InjectionKey<ReturnType<typeof useCurseforgeInstaller>> = Symbol('curseforgeInstaller')

export function useCurseforgeInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  resolveResource: (options: InstallMarketOptionWithInstance) => Promise<InstanceFile[]>,
  installDefaultModLoader = useInstanceModLoaderDefault(),
  resolveArtifactDependencies?: ResolveArtifactModrinthDependencies,
) {
  const installFiles = useMarketInstall()

  const install = async (file: { fileId: number; icon?: string } | { fileId: number; icon?: string }[]) => {
    const files = await resolveResource({
      market: MarketType.CurseForge,
      file,
      instancePath: path.value,
    })
    return installFiles(path.value, [], files)
  }

  async function installWithDependencies(fileId: number, loaders: string[], icon: string | undefined, installed: ProjectFile[], deps: Array<{
    type: FileRelationType
    file: File
    files: File[]
    project: Mod
  }>, artifactUrl?: string, gameVersions?: string[]) {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    const currentMc = _runtime.minecraft
    const needsGameVersionAdapt = Boolean(gameVersions && gameVersions.length > 0 && !gameVersions.includes(currentMc))
    const hasCompatibleLoader = loaders.some(l => {
      if (l === 'fabric' && (_runtime.fabricLoader || _runtime.quiltLoader)) return true
      if (l === 'forge' && _runtime.forge) return true
      if (l === 'neoforge' && _runtime.neoForged) return true
      if (l === 'quilt' && _runtime.quiltLoader) return true
      return false
    })

    const hasConnector = _allFiles.some(f => f.path.toLowerCase().includes('connector'))
    const isConnectorCompatible = hasConnector && (_runtime.neoForged || _runtime.forge) && (loaders.includes('fabric') || loaders.includes('quilt'))

    if (isNoModLoader(runtime.value) || (!hasCompatibleLoader && !isConnectorCompatible) || needsGameVersionAdapt) {
      const success = await installDefaultModLoader(_path, _runtime, loaders, gameVersions)
      if (!success) {
        return false
      }
    }

    const installedProjects = new Set(_allFiles.flatMap(file => file.curseforge ? [file.curseforge.projectId] : []))
    const files = getRequiredCurseforgeInstallFiles({ id: fileId, icon }, deps, installedProjects)
    const resolved = await resolveResource({ market: MarketType.CurseForge, file: files, instancePath: _path })
    if (resolveArtifactDependencies) {
      const artifactDependencies = await resolveArtifactDependencies(artifactUrl, new Set(), loaders)
      if (artifactDependencies.length) {
        resolved.push(...await resolveResource({ market: MarketType.Modrinth, version: artifactDependencies, instancePath: _path }))
      }
    }
    const domain = resolved[0]?.path.split('/')[0] ?? 'mods'
    const oldFiles = installed.map(file => ({
      path: `${domain}/${basename(file.path)}`,
      hashes: {},
      ...(file.curseforge ? { curseforge: file.curseforge } : {}),
    }))
    await installFiles(_path, oldFiles, resolved)
  }

  return {
    installWithDependencies,
    install,
  }
}
