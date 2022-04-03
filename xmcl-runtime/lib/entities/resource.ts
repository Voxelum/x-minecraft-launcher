import { AnyPersistedResource, AnyResource, FileTypeHint, PersistedResource, PersistedResourceSchema, Resource, ResourceDomain, ResourceType, SourceInformation } from '@xmcl/runtime-api'
import { FileSystem, openFileSystem } from '@xmcl/system'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureFile, rename, stat, Stats, unlink, writeFile } from 'fs-extra'
import { basename, dirname, extname, join } from 'path'
import { FileType, linkOrCopy } from '../util/fs'
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
  parseMetadata: (data: FileSystem) => Promise<T>
  getSuggestedName: (metadata: T) => string
  /**
   * Get ideal uri for this resource
   */
  getUri: (metadata: T) => string[]
}

export interface PersistedResourceBuilder extends Omit<PersistedResourceSchema, 'metadata' | 'version'> {
  icon?: Uint8Array
  path: string

  metadata: unknown
  /**
   * The ino of the file on disk
   */
  ino: number
  /**
   * The size of the resource
   */
  size: number
  /**
   * The suggested ext of the resource
   */
  ext: string
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
export function createPersistedResourceBuilder(source: SourceInformation = {}): PersistedResourceBuilder {
  return {
    name: '',
    fileName: '',
    path: '',
    hash: '',
    ext: '',
    domain: ResourceDomain.Unknown,
    type: ResourceType.Unknown,
    fileType: 'unknown',
    metadata: {},
    ino: 0,
    tags: [],
    size: 0,
    uri: [],
    date: new Date().toJSON(),
    ...source,
  }
}
export function getResourceFromBuilder(builder: PersistedResourceBuilder): PersistedResource {
  const res = { ...builder, iconUri: builder.iconUri ?? `dataroot://${builder.domain}/${builder.fileName}.png` }
  delete res.icon
  return Object.freeze(res)
}
export function getBuilderFromResource(resource: PersistedResource): PersistedResourceBuilder {
  return { ...resource }
}
export function mutateResource<T extends PersistedResource<any>>(resource: T, mutation: (builder: PersistedResourceBuilder) => void): T {
  const builder = getBuilderFromResource(resource)
  mutation(builder)
  return getResourceFromBuilder(builder) as any
}

export function getCurseforgeUrl(project: number, file: number): string {
  return `curseforge://id/${project}/${file}`
}
export function getGithubUrl(owner: string, repo: string, release: string) {
  return `https://api.github.com/repos/${owner}/${repo}/releases/assets/${release}`
}
export function getCurseforgeSourceInfo(project: number, file: number): SourceInformation {
  return {
    curseforge: {
      projectId: project,
      fileId: file,
    },
  }
}

export async function parseResourceWithParser(path: string, fileType: FileType, sha1: string, stat: FileStat, parsers: ResourceParser<any>[]): Promise<[AnyResource, Uint8Array | undefined]> {
  const ext = extname(path)
  let parser: ResourceParser<any> = UNKNOWN_ENTRY
  let metadata: any
  let icon: Uint8Array | undefined
  const fs = await openFileSystem(path)

  for (const p of parsers) {
    try {
      metadata = await p.parseMetadata(fs)
      icon = await p.parseIcon(metadata, fs).catch(() => undefined)
      parser = p
      break
    } catch (e) {
      // skip
    }
  }
  fs.close()
  const slice = sha1.slice(0, 6)
  const name = parser.getSuggestedName(metadata) || basename(path, ext)
  const fileName = `${name}.${slice}`

  return [{
    path,
    fileName,
    name,
    ino: stat.ino,
    size: stat.size,
    ext: extname(path),
    hash: sha1,
    domain: parser.domain,
    type: parser.type,
    fileType,
    metadata,
    uri: parser.getUri(metadata),
  }, icon]
}

export function getRecommendedResourceParsers(path: string, typeHint?: FileTypeHint) {
  const ext = extname(path)
  const hint = typeHint || ''
  const filterFunc: (r: ResourceParser<any>) => boolean = (hint === '*' || hint === '')
    ? (ext ? r => r.ext === ext : () => true)
    : r => r.domain === hint || r.type === hint

  const chains: ResourceParser<any>[] = resourceParsers.filter(filterFunc)
  if (ext === '.zip') {
    chains.push(forgeModParser)
  }
  chains.push(UNKNOWN_ENTRY)
  return chains
}

export function parseResource(path: string, fileType: FileType, sha1: string, stat: FileStat, typeHint?: FileTypeHint) {
  return parseResourceWithParser(path, fileType, sha1, stat, getRecommendedResourceParsers(path, typeHint))
}

/**
 * Persist a resource to disk. This will try to copy or link the resource file to domain direcotry, or rename it if it's already in domain directory.
 * @param resolved The resolved resource
 * @param repository The root of the persistence repo
 * @param source The source
 */
export async function persistResource(resolved: Resource, repository: string, source: SourceInformation, url: string[], icon: Uint8Array | undefined, pending: Set<string>) {
  const { domain, type, metadata, name: suggestedName, uri, hash } = resolved

  const builder = createPersistedResourceBuilder(source)
  builder.name = suggestedName
  builder.metadata = metadata
  builder.domain = domain
  builder.type = type
  builder.icon = icon
  builder.uri.push(...uri, ...url)
  builder.ext = extname(resolved.path)
  builder.hash = hash

  if (source.curseforge) {
    builder.uri.push(getCurseforgeUrl(source.curseforge.projectId, source.curseforge.fileId))
    builder.curseforge = source.curseforge
  }

  if (source.github) {
    builder.uri.push(getGithubUrl(source.github.owner, source.github.repo, source.github.artifact))
    builder.github = source.github
  }

  const name = filenamify(suggestedName, { replacement: '-' })
  let fileName = name
  let location = join(builder.domain, fileName)
  let filePath = join(repository, `${location}${builder.ext}`)
  let metadataPath = join(repository, `${location}.json`)
  let iconPath = join(repository, `${location}.png`)

  if (existsSync(filePath)) {
    fileName = `${name}.${builder.hash.slice(0, 6)}`
    location = join(builder.domain, fileName)
    filePath = join(repository, `${location}${builder.ext}`)
    metadataPath = join(repository, `${location}.json`)
    iconPath = join(repository, `${location}.png`)
  }

  pending.add(filePath)
  await ensureFile(filePath)
  if (dirname(resolved.path) === dirname(filePath)) {
    await rename(resolved.path, filePath)
  } else {
    await linkOrCopy(resolved.path, filePath)
  }
  if (builder.icon) {
    await writeFile(iconPath, builder.icon)
  }

  const fileStatus = await stat(filePath)

  builder.fileName = fileName
  builder.path = filePath
  builder.size = fileStatus.size
  builder.ino = fileStatus.ino

  const resource = getResourceFromBuilder(builder)

  await writeFile(metadataPath, JSON.stringify(resource, null, 4))

  return resource
}

export async function remove(resource: Readonly<PersistedResource>, root: string) {
  const baseName = basename(resource.path, resource.ext)

  const filePath = join(root, resource.domain, `${baseName}${resource.ext}`)
  const metadataPath = join(root, resource.domain, `${baseName}.json`)
  const iconPath = join(root, resource.domain, `${baseName}.png`)

  await unlink(filePath).catch(() => { })
  await unlink(metadataPath).catch(() => { })
  await unlink(iconPath).catch(() => { })
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
