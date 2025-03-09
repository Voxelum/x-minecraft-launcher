import { InstanceFile, Resource } from '@xmcl/runtime-api'
import { Stats } from 'fs'
import { stat } from 'fs-extra'
import { join, relative } from 'path'
import { Logger } from '~/logger'
import { ResourceManager, ResourceWorker } from '~/resource'
import { ENOENT_ERROR, readdirIfPresent } from '../util/fs'
import { isNonnull } from '~/util/object'
import { isSystemError } from '~/util/error'

/**
 * @returns The instance file with file stats array. The InstanceFile does not have hashes and downloads.
 */
export async function discover(instancePath: string, logger: Logger, filter?: (relativePath: string, stats: Stats) => boolean) {
  const files = [] as Array<[InstanceFile, Stats]>

  const scan = async (dirOrFile: string) => {
    const s = await stat(dirOrFile).catch(e => {
      if (isSystemError(e) && e.code === ENOENT_ERROR) {
        return
      }
      throw e
    })
    if (!s) return
    const isDirectory = s.isDirectory()
    const relativePath = relative(instancePath, dirOrFile).replace(/\\/g, '/')
    if (filter && filter(relativePath, s)) {
      return
    }

    if (isDirectory) {
      const children = await readdirIfPresent(dirOrFile)
      await Promise.all(children.map(child => scan(join(dirOrFile, child)).catch((e) => {
        logger.warn(new Error('Fail to get manifest data for instance file', { cause: e }))
      })))
    } else {
      const localFile: InstanceFile = {
        path: relativePath,
        size: s.size,
        hashes: {},
      }
      files.push([localFile, s])
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

export async function decorateInstanceFiles(files: [InstanceFile, Stats][],
  instancePath: string,
  worker: ResourceWorker,
  resourceManager: ResourceManager,
  undecoratedResources: Set<InstanceFile>,
  hashes?: string[]) {
  const sha1Lookup = await resourceManager.getSnapshotsByIon(files
    .filter(([localFile, stat]) => isSpecialFile(localFile.path))
    .map(([localFile, stat]) => stat.ino))
    .then(v => Object.fromEntries(v.map(s => [s.ino, s.sha1])))

  for (const [localFile, stat] of files) {
    const relativePath = localFile.path
    const filePath = join(instancePath, relativePath)
    const ino = stat.ino
    if (isSpecialFile(relativePath)) {
      const sha1 = sha1Lookup[ino] || await worker.checksum(filePath, 'sha1')
      localFile.hashes.sha1 = sha1
    }
  }

  const exsitedSha1 = files.map(f => f[0].hashes.sha1).filter(isNonnull)

  const metadataLookup = await resourceManager.getMetadataByHashes(exsitedSha1).then(v => {
    return Object.fromEntries(v.filter(isNonnull).map(m => [m.sha1, m]))
  })
  const urisLookup = await resourceManager.getUrisByHash(exsitedSha1).then(v => {
    return v.reduce((acc, cur) => {
      if (!acc[cur.sha1]) {
        acc[cur.sha1] = []
      }
      acc[cur.sha1].push(cur.uri)
      return acc
    }, {} as Record<string, string[]>)
  })

  for (const [localFile, stat] of files) {
    const relativePath = localFile.path
    const filePath = join(instancePath, relativePath)
    if (isSpecialFile(relativePath)) {
      const sha1 = localFile.hashes.sha1
      const metadata = metadataLookup[sha1]
      if (metadata?.modrinth) {
        localFile.modrinth = {
          projectId: metadata.modrinth.projectId,
          versionId: metadata.modrinth.versionId,
        }
      }
      if (metadata?.curseforge) {
        localFile.curseforge = {
          projectId: metadata.curseforge.projectId,
          fileId: metadata.curseforge.fileId,
        }
      }

      const uris = urisLookup[sha1]
      localFile.downloads = uris && uris.some(u => u.startsWith('http')) ? uris.filter(u => u.startsWith('http')) : undefined
      localFile.hashes = {
        ...localFile.hashes,
        ...await resolveHashes(filePath, worker, hashes, sha1),
      }

      // No download url...
      if ((!localFile.downloads || localFile.downloads.length === 0) && metadata) {
        undecoratedResources.add(localFile)
      }
    } else {
      localFile.hashes = {
        ...localFile.hashes,
        ...await resolveHashes(filePath, worker, hashes),
      }
    }
  }
}
