import { Persisted, Resource, ResourceData, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import { FileSystem, openFileSystem } from '@xmcl/system'
import { AbstractSublevel } from 'abstract-level'
import { ClassicLevel } from 'classic-level'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureFile, rename, stat, Stats } from 'fs-extra'
import { dirname, extname, join } from 'path'
import { linkOrCopy } from '../util/fs'
import resourceParsers from './resourceParsers'
import { forgeModParser } from './resourceParsers/forgeMod'

export interface FileStat extends Omit<Stats, 'isFile' | 'isDirectory' | 'isBlockDevice' | 'isCharacterDevice' | 'isSymbolicLink' | 'isFIFO' | 'isSocket'> {
  isFile: boolean
  isDirectory: boolean
  isBlockDevice: boolean
  isCharacterDevice: boolean
  isSymbolicLink: boolean
  isFIFO: boolean
  isSocket: boolean
}

export function extractKeywords<T>(resource: ResourceData) {
  const result = [] as string[]

  return result
}

/**
 * The indexer for a specific resource domain
 */
export class ResourceDomainIndexer<T> {
  private hashSet: AbstractSublevel<any, string | Buffer, string, string>
  private uriIndex: AbstractSublevel<any, string | Buffer, string, string>
  private keywordIndex: AbstractSublevel<any, string | Buffer, string, string[]>
  private keywords: AbstractSublevel<any, string | Buffer, string, string[]>

  constructor(readonly parent: ClassicLevel<string, ResourceData>, name: string) {
    this.hashSet = parent.sublevel<string, string>(name, { keyEncoding: 'hex' })
    this.uriIndex = this.hashSet.sublevel<string, string>('uri-index', { valueEncoding: 'hex' })
    this.keywordIndex = this.hashSet.sublevel<string, string[]>('keyword-index', { valueEncoding: 'json' })
    this.keywords = this.hashSet.sublevel<string, string[]>('keywords', { valueEncoding: 'json' })
  }

  async put(resource: ResourceData) {
    const batch = this.hashSet.batch()

    batch.put(resource.hash, '')

    for (const uri of resource.uri) {
      batch.put(uri, resource.hash, { sublevel: this.uriIndex })
    }

    const existed = await this.keywordIndex.getMany(resource.tags)
    for (let i = 0; i < existed.length; i++) {
      const resourceHashes = existed[i]
      if (resourceHashes) {
        batch.put(resource.tags[i], [...resourceHashes, resource.hash], { sublevel: this.keywordIndex })
      } else {
        batch.put(resource.tags[i], [resource.hash], { sublevel: this.keywordIndex })
      }
    }

    await batch.write()
  }

  async del(resource: ResourceData | string) {
    const key = typeof resource === 'string' ? resource : resource.hash
    const res = typeof resource === 'string' ? await this.parent.get(await this.hashSet.get(key)) : resource

    const batch = this.hashSet.batch()

    batch.del(key)

    for (const uri of res.uri) {
      batch.del(uri)
    }

    // for (const tag of res.tags) {

    // }

    this.hashSet.del(key)
  }

  get() { }

  getAll(size: number, offset: number) {

  }
}

export interface ResourceParser<T> {
  type: ResourceType
  domain: ResourceDomain
  ext: string
  parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>
  parseMetadata: (data: FileSystem, filePath: string, metadata: Resource['metadata']) => Promise<T>
  getSuggestedName: (metadata: T) => string
  /**
   * Get ideal uri for this resource
   */
  getUri: (metadata: T) => string[]
}

// resource functions

/**
 * Create a resource builder from source.
 */

export function getCurseforgeUrl(project: number, file: number): string {
  return `curseforge://id/${project}/${file}`
}
export function getGithubUrl(owner: string, repo: string, release: string) {
  return `https://api.github.com/repos/${owner}/${repo}/releases/assets/${release}`
}

export async function parseResourceMetadata(resource: Resource): Promise<{ resource: Resource; icons: Uint8Array[] }> {
  const inspectExt = resource.fileType === 'zip' ? '.zip' : undefined
  const ext = extname(resource.path)

  let parsers: ResourceParser<any>[]
  if (resource.domain === ResourceDomain.Unclassified) {
    if (ext) {
      parsers = resourceParsers.filter(r => r.ext === ext)
      if (parsers.length === 0 && inspectExt) {
        parsers.push(...resourceParsers.filter(r => r.ext === inspectExt), forgeModParser)
      }
    } else {
      if (inspectExt) {
        parsers = resourceParsers.filter(r => r.ext === inspectExt).concat(forgeModParser)
      } else {
        parsers = [...resourceParsers]
      }
    }
  } else {
    parsers = resourceParsers.filter(r => r.domain === resource.domain)
  }

  const icons: Uint8Array[] = []
  const fs = await openFileSystem(resource.path)

  for (const parser of parsers) {
    if (resource.domain !== ResourceDomain.Unclassified) {
      if (parser.domain !== resource.domain) {
        continue
      }
    }
    try {
      const metadata = await parser.parseMetadata(fs, resource.path, resource.metadata)
      const icon = await parser.parseIcon(metadata, fs).catch(() => undefined)
      resource.domain = parser.domain
      resource.metadata[parser.type] = metadata
      resource.uri.push(...parser.getUri(metadata))
      const suggested = parser.getSuggestedName(metadata)
      if (suggested) {
        resource.name = suggested
      }
      if (icon) {
        icons.push(icon)
      }
    } catch (e) {
      // skip
    }
  }
  fs.close()

  return { resource, icons }
}

export function getStoragePath(resolved: Resource, root: string) {
  const fileName = filenamify(resolved.fileName, { replacement: '-' })
  const filePath = join(root, resolved.domain, fileName)
  return filePath
}

/**
 * Persist a resource to disk. This will try to copy or link the resource file to domain directory, or rename it if it's already in domain directory.
 *
 * Notice the return persisted resource will set `path` to the `storePath`
 *
 * @param resolved The resolved resource
 * @param root The root of the persistence storage
 */
export async function persistResource(resolved: Resource, root: string, pending: Set<string>): Promise<Persisted<Resource>> {
  let fileName = filenamify(resolved.fileName, { replacement: '-' })
  let filePath = join(root, resolved.domain, fileName)

  const existed = existsSync(filePath)
  const alreadyStored = existed ? (await stat(filePath)).ino === resolved.ino : false

  if (!alreadyStored) {
    if (existed) {
      // fileName conflict
      fileName = filenamify(`${resolved.name}.${resolved.hash.slice(0, 6)}${extname(resolved.fileName)}`)
      filePath = join(root, resolved.domain, fileName)
    }

    // skip to handle the file if it's inside the resource dir
    pending.add(filePath)
    await ensureFile(filePath)
    if (dirname(resolved.path) === dirname(filePath)) {
      // just rename if they are in same dir
      await rename(resolved.path, filePath)
    } else {
      await linkOrCopy(resolved.path, filePath)
    }
  }

  const fileStatus = await stat(filePath)
  return {
    ...resolved,
    path: filePath,
    ino: fileStatus.ino,
    size: fileStatus.size,
    storedDate: Date.now(),
    storedPath: filePath,
  }
}

// resource class

export class ResourceCache {
  private cache: Record<string, Persisted<Resource> | undefined> = {}

  put(resource: Persisted<Resource>) {
    this.cache[resource.hash] = resource
    if (resource.uri) {
      for (const url of resource.uri) {
        this.cache[url] = resource
      }
    }
    this.cache[resource.ino] = resource
    this.cache[resource.path] = resource
    if (resource.metadata.curseforge) {
      this.cache[getCurseforgeUrl(resource.metadata.curseforge.projectId, resource.metadata.curseforge.fileId)] = resource
    }
  }

  discard(resource: Persisted<Resource>) {
    delete this.cache[resource.hash]
    for (const url of resource.uri) {
      delete this.cache[url]
    }
    delete this.cache[resource.ino]
    delete this.cache[resource.path]
  }

  get(key: string | number) {
    return this.cache[key]
  }
}
