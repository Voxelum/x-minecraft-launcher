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

/**
 * Get the primary file of the modrinth version
 *
 * If there are no file marked as primary, it will try to find mrpack or jar file instead of zip file first.
 */
export function getModrinthPrimaryFile(version: ProjectVersion) {
  const primaryFiles = version.files.filter(f => f.primary)
  let files = primaryFiles.length === 0 ? version.files : primaryFiles
  if (files.some(f => f.filename.endsWith('.zip')) &&
    files.some(f => f.filename.endsWith('.mrpack') || f.filename.endsWith('.jar'))) {
    files = files.filter(f => f.filename.endsWith('.mrpack') || f.filename.endsWith('.jar'))
  }
  return files[0]
}
