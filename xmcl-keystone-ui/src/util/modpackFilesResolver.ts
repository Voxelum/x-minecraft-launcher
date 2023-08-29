import { Resource, getInstanceConfigFromCurseforgeModpack, getInstanceConfigFromMcbbsModpack, getInstanceConfigFromModrinthModpack } from '@xmcl/runtime-api'

export function resolveModpackInstanceConfig(r: Resource) {
  if (r.metadata['modrinth-modpack']) {
    return { ...getInstanceConfigFromModrinthModpack(r.metadata['modrinth-modpack']), icon: r.icons?.[0] }
  }
  if (r.metadata['curseforge-modpack']) {
    return { ...getInstanceConfigFromCurseforgeModpack(r.metadata['curseforge-modpack']), icon: r.icons?.[0] }
  }
  if (r.metadata['mcbbs-modpack']) {
    return { ...getInstanceConfigFromMcbbsModpack(r.metadata['mcbbs-modpack']), icon: r.icons?.[0] }
  }
}
