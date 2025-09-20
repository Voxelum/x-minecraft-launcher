import type { InstanceUpstream } from '@xmcl/instance'

export function isUpstreamIsSameOrigin(a: InstanceUpstream, b: InstanceUpstream) {
  const aType = a.type
  const bType = b.type
  if (aType !== bType) return false
  if (a.type === 'curseforge-modpack') return a.modId === (b as any).modId
  if (a.type === 'modrinth-modpack') return a.projectId === (b as any).projectId
  if (a.type === 'ftb-modpack') return a.id === (b as any).id
  if (a.type === 'peer') return a.id === (b as any).id
  return false
}
