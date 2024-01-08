import { InstanceFile, Resource } from '@xmcl/runtime-api'
import { Stats } from 'fs'
import { stat } from 'fs-extra'
import { join, relative } from 'path'
import { Logger } from '~/logger'
import { ResourceService, ResourceWorker } from '~/resource'
import { readdirIfPresent } from '../util/fs'

/**
 * @returns The instance file with file stats array. The InstanceFile does not have hashes and downloads.
 */
export async function discover(instancePath: string, logger: Logger, filter?: (relativePath: string) => boolean) {
  const files = [] as Array<[InstanceFile, Stats]>

  const scan = async (p: string) => {
    const status = await stat(p)
    const isDirectory = status.isDirectory()
    const relativePath = relative(instancePath, p).replace(/\\/g, '/')
    if (filter && filter(relativePath)) {
      return
    }
    if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
      if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
        return
      }
    }
    if (relativePath === 'instance.json') {
      return
    }
    // no lib or exe
    if (relativePath.endsWith('.dll') || relativePath.endsWith('.so') || relativePath.endsWith('.exe')) {
      return
    }
    // do not share versions/libs/assets
    if (relativePath.startsWith('versions') || relativePath.startsWith('assets') || relativePath.startsWith('libraries')) {
      return
    }

    if (isDirectory) {
      const children = await readdirIfPresent(p)
      await Promise.all(children.map(child => scan(join(p, child)).catch((e) => {
        logger.error(new Error('Fail to get manifest data for instance file', { cause: e }))
      })))
    } else {
      const localFile: InstanceFile = {
        path: relativePath,
        size: status.size,
        hashes: {},
      }
      files.push([localFile, status])
    }
  }

  files.shift()

  await scan(instancePath)

  return files
}

const resolveHashes = async (file: string, worker: ResourceWorker, hashes?: string[], sha1?: string) => {
  const result: Record<string, string> = {}
  if (hashes) {
    for (const hash of hashes) {
      if (hash === 'sha1') {
        if (sha1) {
          result.sha1 = sha1
        } else {
          result[hash] = await worker.checksum(file, hash)
        }
        continue
      } else {
        result[hash] = await worker.checksum(file, hash)
      }
    }
  }
  return result as any
}

export const isSpecialFile = (relativePath: string) =>
  (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks') || relativePath.startsWith('mods')) &&
  !relativePath.endsWith('.txt')

export async function decoareteInstanceFileFromResourceCache(
  localFile: InstanceFile,
  stat: Stats,
  instancePath: string,
  worker: ResourceWorker,
  resourceService: ResourceService,
  undecorated: Array<InstanceFile>,
  undecoratedResources: Map<InstanceFile, Resource>,
  hashes?: string[],
) {
  const relativePath = localFile.path
  const filePath = join(instancePath, relativePath)
  const ino = stat.ino
  if (isSpecialFile(relativePath)) {
    let resource = await resourceService.getReosurceByIno(ino)
    const sha1 = resource?.hash ?? await worker.checksum(filePath, 'sha1')
    if (!resource) {
      resource = await resourceService.getResourceByHash(sha1)
    }
    if (resource?.metadata.modrinth) {
      localFile.modrinth = {
        projectId: resource.metadata.modrinth.projectId,
        versionId: resource.metadata.modrinth.versionId,
      }
    }
    if (resource?.metadata.curseforge) {
      localFile.curseforge = {
        projectId: resource.metadata.curseforge.projectId,
        fileId: resource.metadata.curseforge.fileId,
      }
    }
    localFile.downloads = resource?.uris && resource.uris.some(u => u.startsWith('http')) ? resource.uris.filter(u => u.startsWith('http')) : undefined
    localFile.hashes = await resolveHashes(filePath, worker, hashes, sha1)

    // No download url...
    if ((!localFile.downloads || localFile.downloads.length === 0)) {
      undecorated.push(localFile)
      if (resource) {
        undecoratedResources.set(localFile, resource)
      }
    }
  } else {
    localFile.hashes = await resolveHashes(filePath, worker)
  }
}
