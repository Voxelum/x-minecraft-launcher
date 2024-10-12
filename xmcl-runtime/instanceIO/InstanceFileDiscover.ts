import { InstanceFile, Resource } from '@xmcl/runtime-api'
import { Stats } from 'fs'
import { stat } from 'fs-extra'
import { join, relative } from 'path'
import { Logger } from '~/logger'
import { ResourceManager, ResourceWorker } from '~/resource'
import { readdirIfPresent } from '../util/fs'
import { isNonnull } from '~/util/object'

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
      const sha1 = sha1Lookup[ino] ?? await worker.checksum(filePath, 'sha1')
      sha1Lookup[ino] = sha1
    }
  }

  const metadataLookup = await resourceManager.getMetadataByHashes(Object.values(sha1Lookup)).then(v => {
    return Object.fromEntries(v.filter(isNonnull).map(m => [m.sha1, m]))
  })
  const urisLookup = await resourceManager.getUrisByHash(Object.values(sha1Lookup)).then(v => {
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
    const ino = stat.ino
    if (isSpecialFile(relativePath)) {
      const sha1 = sha1Lookup[ino]
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
      localFile.hashes = await resolveHashes(filePath, worker, hashes, sha1)

      // No download url...
      if ((!localFile.downloads || localFile.downloads.length === 0) && metadata) {
        undecoratedResources.add(localFile)
      }
    } else {
      localFile.hashes = await resolveHashes(filePath, worker)
    }
  }
}
