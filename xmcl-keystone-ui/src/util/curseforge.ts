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
  return file.gameVersions.filter(v => !Number.isInteger(Number(v[0]))).map(v => v.toLocaleLowerCase())
}

export function getCurseforgeFileGameVersions(file: File): string[] {
  return file.gameVersions.filter(v => Number.isInteger(Number(v[0])))
}

export function getCursforgeModLoadersFromString(loaderTypes: ModLoaderFilter[]) {
  const mapping = {
    [ModLoaderFilter.fabric]: FileModLoaderType.Fabric,
    [ModLoaderFilter.forge]: FileModLoaderType.Forge,
    [ModLoaderFilter.quilt]: FileModLoaderType.Quilt,
    [ModLoaderFilter.neoforge]: FileModLoaderType.NeoForge,
  }
  return loaderTypes.map(loaderType => mapping[loaderType])
}

export function getCurseforgeModLoaderTypeFromRuntime(runtime: RuntimeVersions, returnAnyIfNoModLoader = true) {
  const noModLoader = isNoModLoader(runtime)
  const modLoaderType =
    noModLoader && returnAnyIfNoModLoader
      ? FileModLoaderType.Any
      : (runtime.forge)
        ? FileModLoaderType.Forge
        : runtime.fabricLoader
          ? FileModLoaderType.Fabric
          : runtime.quiltLoader
            ? FileModLoaderType.Quilt
            : runtime.neoForged
            ? FileModLoaderType.NeoForge
            : FileModLoaderType.Any
  return modLoaderType
}
