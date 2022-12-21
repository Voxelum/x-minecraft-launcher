import { Resource, ResourceDomain } from '@xmcl/runtime-api'
import { basename, join } from 'path'
import { IResourceData, ResourceEntryCache, ResourceEntryPath } from './ResourceContext'

export function generateResource(root: string, entry: ResourceEntryCache | ResourceEntryPath, metadata?: IResourceData, overwrite?: { path?: string; domain?: ResourceDomain }): Resource {
  let fileName: string
  let path: string
  let storedPath: string | undefined
  let domain: ResourceDomain | undefined
  if ('domain' in entry) {
    fileName = entry.fileName
    path = join(root, entry.domain, entry.fileName)
    storedPath = path
    domain = entry.domain
  } else {
    fileName = basename(entry.path)
    path = entry.path
  }
  if (overwrite?.path) {
    path = overwrite.path
  }
  if (overwrite?.domain) {
    domain = overwrite.domain
  }
  return {
    version: 2,
    ino: entry.ino,
    domain: domain || ResourceDomain.Unclassified,
    fileName,
    path,
    metadata: metadata ?? {},
    icons: metadata?.icons || [],
    storedPath,
    storedDate: entry.ctime,
    tags: metadata?.tags || [],
    uris: metadata?.uris || [],
    size: entry.size,
    hash: entry.sha1,
    name: metadata?.name ?? fileName,
    fileType: entry.fileType,
  }
}
