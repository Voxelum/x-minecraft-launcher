import { AnyPersistedResource, AnyResource, FileTypeHint, PersistedResource, Resource, ResourceDomain, ResourceMetadata, ResourceType, ResourceSources } from '@xmcl/runtime-api'
import { FileSystem, openFileSystem } from '@xmcl/system'
import { ClassicLevel } from 'classic-level'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureFile, rename, stat, Stats, unlink, writeFile } from 'fs-extra'
import { basename, dirname, extname, join, resolve } from 'path'
import { fileType as getFileType, FileType, linkOrCopy, checksum } from '../util/fs'
import resourceParsers from './resourceParsers'
import { forgeModParser } from './resourceParsers/forgeMod'
import { AbstractLevel, AbstractSublevel } from 'abstract-level'
import { ParseResourceContext } from '../services/ResourceService'

export interface FileStat extends Omit<Stats, 'isFile' | 'isDirectory' | 'isBlockDevice' | 'isCharacterDevice' | 'isSymbolicLink' | 'isFIFO' | 'isSocket'> {
  isFile: boolean
  isDirectory: boolean
  isBlockDevice: boolean
  isCharacterDevice: boolean
  isSymbolicLink: boolean
  isFIFO: boolean
  isSocket: boolean
}

export function extractKeywords<T>(resource: ResourceMetadata<T>) {
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

  constructor(readonly parent: ClassicLevel<string, ResourceMetadata<any>>, name: string) {
    this.hashSet = parent.sublevel<string, string>(name, { keyEncoding: 'hex' })
    this.uriIndex = this.hashSet.sublevel<string, string>('uri-index', { valueEncoding: 'hex' })
    this.keywordIndex = this.hashSet.sublevel<string, string[]>('keyword-index', { valueEncoding: 'json' })
    this.keywords = this.hashSet.sublevel<string, string[]>('keywords', { valueEncoding: 'json' })
  }

  async put(resource: ResourceMetadata<T>) {
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

  async del(resource: ResourceMetadata<T> | string) {
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

export async function readFileStat(path: string): Promise<FileStat> {
  const result = await stat(path)
  return {
    ...result,
    isFile: result.isFile(),
    isDirectory: result.isDirectory(),
    isBlockDevice: result.isBlockDevice(),
    isCharacterDevice: result.isCharacterDevice(),
    isSymbolicLink: result.isSymbolicLink(),
    isFIFO: result.isFIFO(),
    isSocket: result.isSocket(),
  }
}

export interface ResourceParser<T> {
  type: ResourceType
  domain: ResourceDomain
  ext: string
  parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>
  parseMetadata: (data: FileSystem, filePath: string) => Promise<T>
  getSuggestedName: (metadata: T) => string
  /**
   * Get ideal uri for this resource
   */
  getUri: (metadata: T) => string[]
}

// resource entries

export const UNKNOWN_ENTRY: ResourceParser<unknown> = {
  type: ResourceType.Unknown,
  domain: ResourceDomain.Unknown,
  ext: '*',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: () => Promise.resolve({}),
  getSuggestedName: () => '',
  getUri: () => [],
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
export function getCurseforgeSourceInfo(project: number, file: number): ResourceSources {
  return {
    curseforge: {
      projectId: project,
      fileId: file,
    },
  }
}

export async function parseResource(path: string, context: ParseResourceContext, typeHint?: FileTypeHint): Promise<[AnyResource, Uint8Array | undefined]> {
  const fileType = context.fileType ?? await getFileType(path)
  const hint = typeHint || ''
  const sha1 = context.sha1 ?? await checksum(path, 'sha1')
  const fstat = context.stat ?? await stat(path)
  const ext = extname(path)
  const inspectExt = fileType === 'zip' ? '.zip' : undefined

  let parsers: ResourceParser<any>[]
  if (hint === '*' || hint === '') {
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
    parsers = resourceParsers.filter(r => r.domain === hint || r.type === hint)
  }
  parsers.push(UNKNOWN_ENTRY)

  let parser: ResourceParser<any> = UNKNOWN_ENTRY
  let metadata: any
  let icon: Uint8Array | undefined
  const fs = await openFileSystem(path).catch(e => undefined)

  if (fs) {
    for (const p of parsers) {
      try {
        metadata = await p.parseMetadata(fs, path)
        icon = await p.parseIcon(metadata, fs).catch(() => undefined)
        parser = p
        break
      } catch (e) {
        // skip
      }
    }
    fs.close()
  } else {
    parser = UNKNOWN_ENTRY
  }
  const fileName = basename(path)
  const name = parser.getSuggestedName(metadata) || basename(path, ext)

  return [{
    version: 1,
    path,
    fileName,
    name,
    ino: fstat.ino,
    size: fstat.size,
    hash: sha1,
    domain: parser.domain,
    type: parser.type,
    metadata,
    uri: parser.getUri(metadata),
    fileType,
    tags: [],
  }, icon]
}

/**
 * Persist a resource to disk. This will try to copy or link the resource file to domain directory, or rename it if it's already in domain directory.
 * @param resolved The resolved resource
 * @param root The root of the persistence storage
 */
export async function persistResource<T>(resolved: Resource<T>, root: string, pending: Set<string>): Promise<PersistedResource<T>> {
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
  private cache: Record<string, AnyPersistedResource | undefined> = {}

  put(resource: AnyPersistedResource) {
    this.cache[resource.hash] = resource
    if (resource.uri) {
      for (const url of resource.uri) {
        this.cache[url] = resource
      }
    }
    this.cache[resource.ino] = resource
    this.cache[resource.path] = resource
    if (resource.curseforge) {
      this.cache[getCurseforgeUrl(resource.curseforge.projectId, resource.curseforge.fileId)] = resource
    }
  }

  discard(resource: PersistedResource) {
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
