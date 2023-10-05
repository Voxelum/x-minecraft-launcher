import { File, FileModLoaderType, FileRelationType } from '@xmcl/curseforge'
import { RuntimeVersions } from '@xmcl/runtime-api'
import { isNoModLoader } from './isNoModloader'
import { ModLoaderFilter } from '@/composables/modSearch'

export function getCurseforgeRelationType(type: FileRelationType) {
  return type === FileRelationType.RequiredDependency
    ? 'required'
    : type === FileRelationType.OptionalDependency || type === FileRelationType.Tool
      ? 'optional'
      : type === FileRelationType.Incompatible
        ? 'incompatible'
        : 'embedded'
}

export function getCursforgeFileModLoaders(file: File): string[] {
  return file.gameVersions.filter(v => !Number.isInteger(Number(v[0])))
}

export function getCursforgeModLoadersFromString(loaderTypes: ModLoaderFilter[]) {
  const mapping = {
    [ModLoaderFilter.fabric]: 'Fabric',
    [ModLoaderFilter.forge]: 'Forge',
    [ModLoaderFilter.quilt]: 'Quilt',
  }
  return loaderTypes.map(loaderType => mapping[loaderType])
}

export function getCurseforgeModLoaderTypeFromRuntime(runtime: RuntimeVersions, returnAnyIfNoModLoader = true) {
  const noModLoader = isNoModLoader(runtime)
  const modLoaderType =
    noModLoader && returnAnyIfNoModLoader
      ? FileModLoaderType.Any
      : (runtime.forge || runtime.neoForged)
        ? FileModLoaderType.Forge
        : runtime.fabricLoader
          ? FileModLoaderType.Fabric
          : runtime.quiltLoader
            ? FileModLoaderType.Quilt
            : FileModLoaderType.Any
  return modLoaderType
}
