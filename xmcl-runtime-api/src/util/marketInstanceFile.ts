import { HashAlgo, type File } from '@xmcl/curseforge'
import type { InstanceFile } from '@xmcl/instance'
import type { ProjectVersion } from '@xmcl/modrinth'

export function getInstanceFileFromCurseforgeFile(file: File, destinationPrefix = 'mods'): InstanceFile {
  return {
    path: `${destinationPrefix}/${file.fileName}`,
    hashes: {
      sha1: file.hashes.find(hash => hash.algo === HashAlgo.Sha1)?.value as string,
    },
    size: file.fileLength,
    curseforge: {
      projectId: file.modId,
      fileId: file.id,
    },
  }
}

export function getInstanceFileFromModrinthVersion(version: ProjectVersion, destinationPrefix = 'mods', filename?: string): InstanceFile {
  const primary = version.files.find(file => file.filename === filename) || version.files.find(file => file.primary) || version.files[0]
  return {
    path: `${destinationPrefix}/${primary.filename}`,
    hashes: primary.hashes,
    size: 0,
    modrinth: {
      projectId: version.project_id,
      versionId: version.id,
    },
  }
}