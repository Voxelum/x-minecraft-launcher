import { ResourceDomain, ResourceMetadata, ResourceType } from '@xmcl/runtime-api'

export function resolveDomain(data: ResourceMetadata) {
  if (data[ResourceType.Forge] ||
    data[ResourceType.Fabric] ||
    data[ResourceType.Quilt] ||
    data[ResourceType.Liteloader]) {
    return ResourceDomain.Mods
  }
  if (data[ResourceType.Modpack] ||
    data[ResourceType.ModrinthModpack] ||
    data[ResourceType.CurseforgeModpack] ||
    data[ResourceType.McbbsModpack]) {
    return ResourceDomain.Modpacks
  }
  if (data[ResourceType.Save]) {
    return ResourceDomain.Saves
  }
  if (data[ResourceType.ResourcePack]) {
    return ResourceDomain.ResourcePacks
  }
  if (data[ResourceType.ShaderPack]) {
    return ResourceDomain.ShaderPacks
  }
  return ResourceDomain.Unclassified
}
