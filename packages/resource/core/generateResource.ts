import { Resource } from '../Resource'
import { ResourceType } from '../ResourceType'
import { ResourceMetadata } from '../ResourceMetadata'
import { File } from '../File'
import { ResourceSnapshotTable } from '../schema'

export function pickMetadata(metadata: ResourceMetadata): ResourceMetadata {
  return {
    neoforge: metadata.neoforge,
    [ResourceType.Forge]: metadata[ResourceType.Forge],
    [ResourceType.Fabric]: metadata[ResourceType.Fabric],
    [ResourceType.Liteloader]: metadata[ResourceType.Liteloader],
    [ResourceType.Quilt]: metadata[ResourceType.Quilt],
    [ResourceType.ResourcePack]: metadata[ResourceType.ResourcePack],
    [ResourceType.ShaderPack]: metadata[ResourceType.ShaderPack],
    instance: metadata.instance,
    github: metadata.github,
    curseforge: metadata.curseforge,
    modrinth: metadata.modrinth,
    gitlab: metadata.gitlab,
  }
}

export function generateResourceV3(
  file: File,
  record: ResourceSnapshotTable,
  metadata: ResourceMetadata & { icons?: string[] },
): Resource {
  const resource: Resource = {
    version: 3,
    ...file,
    name: metadata.name ?? file.fileName,
    hash: record.sha1,
    metadata: pickMetadata(metadata),
    icons: metadata.icons,
  }
  return resource
}
