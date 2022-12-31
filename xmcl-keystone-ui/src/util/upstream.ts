import { InstanceData, Resource } from '@xmcl/runtime-api'

export function getUpstreamFromResource(resource: Resource): InstanceData['upstream'] {
  if (resource.metadata.curseforge) {
    return {
      type: 'curseforge-modpack',
      modId: resource.metadata.curseforge.projectId,
      fileId: resource.metadata.curseforge.fileId,
      sha1: resource.hash,
    }
  }
  if (resource.metadata.modrinth) {
    return {
      type: 'modrinth-modpack',
      projectId: resource.metadata.modrinth.projectId,
      versionId: resource.metadata.modrinth.versionId,
      sha1: resource.hash,
    }
  }
}
