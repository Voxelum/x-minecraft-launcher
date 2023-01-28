import { ProjectVersion } from '@xmcl/modrinth'

export const modrinthDenyHost = ['edge.forgecdn.net', 'media.forgecdn.net']
export const modrinthAllowHost = ['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com']
export function isAllowInModrinthModpack(url: string, strict = true) {
  // @ts-ignore
  const result = new URL(url)
  if (result.protocol !== 'http:' && result.protocol !== 'https:') {
    return false
  }
  if (modrinthDenyHost.indexOf(result.host) !== -1) {
    return false
  }
  if (!strict) {
    return true
  }
  if (modrinthAllowHost.indexOf(result.host) === -1) {
    return false
  }
  return true
}

export interface ModrinthProjectHeader {
  id: string
  logoUrl: string
  type: 'mod' | 'modpack'
  summary: string
  websiteUrl: string
}

export function getModrinthVersionUrl(version: ProjectVersion) {
  return version.files[0].url
}
export function getModrinthVersionUri(version: Pick<ProjectVersion, 'project_id' | 'id'>) {
  return `modrinth:${version.project_id}:${version.id}`
}

export function getModrinthVersionFileUri(version: Pick<ProjectVersion, 'project_id' | 'id'> & { filename: string }) {
  return `modrinth:${version.project_id}:${version.id}:${version.filename}`
}
