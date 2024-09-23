import { Resource, getInstanceConfigFromCurseforgeModpack, getInstanceConfigFromMcbbsModpack, getInstanceConfigFromMmcModpack, getInstanceConfigFromModrinthModpack } from '@xmcl/runtime-api'

export function resolveModpackInstanceConfig(r: Resource) {
  if (r.metadata['modrinth-modpack']) {
    return {
      ...getInstanceConfigFromModrinthModpack(r.metadata['modrinth-modpack']),
      icon: r.icons?.[0],
      upstream: r.metadata.modrinth
        ? {
          type: 'modrinth-modpack' as const,
          projectId: r.metadata.modrinth.projectId,
          versionId: r.metadata.modrinth.versionId,
          sha1: r.hash,
        }
        : undefined,
    }
  }
  if (r.metadata['curseforge-modpack']) {
    return {
      ...getInstanceConfigFromCurseforgeModpack(r.metadata['curseforge-modpack']),
      icon: r.icons?.[0],
      upstream: r.metadata.curseforge
        ? {
          type: 'curseforge-modpack' as const,
          modId: r.metadata.curseforge.projectId,
          fileId: r.metadata.curseforge.fileId,
          sha1: r.hash,
        }
        : undefined,
    }
  }
  if (r.metadata['mcbbs-modpack']) {
    return { ...getInstanceConfigFromMcbbsModpack(r.metadata['mcbbs-modpack']), icon: r.icons?.[0] }
  }
  if (r.metadata['mmc-modpack']) {
    return { ...getInstanceConfigFromMmcModpack(r.metadata['mmc-modpack']), icon: r.icons?.[0] }
  }
}
