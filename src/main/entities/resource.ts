import { Version } from '@xmcl/core'
import { FabricModMetadata, LiteloaderModMetadata, readFabricMod, readForgeMod, readLiteloaderMod } from '@xmcl/mod-parser'
import { PackMeta, readIcon, readPackMeta } from '@xmcl/resourcepack'
import { FileSystem, openFileSystem } from '@xmcl/system'
import filenamify from 'filenamify'
import { ensureFile, stat, Stats, unlink, writeFile } from 'fs-extra'
import { basename, extname, join } from 'path'
import { findLevelRootDirectory, readResourceSaveMetadata } from './save'
import { FileType, linkOrCopy } from '/@main/util/fs'
import { CurseforgeModpackManifest } from '/@shared/entities/curseforge'
import { RuntimeVersions } from '/@shared/entities/instance.schema'
import { ForgeModCommonMetadata, normalizeForgeModMetadata } from '/@shared/entities/mod'
import { AnyPersistedResource, AnyResource, PersistedResource, SourceInformation } from '/@shared/entities/resource'
import { PersistedResourceSchema, Resource, ResourceDomain, ResourceType } from '/@shared/entities/resource.schema'
import { ResourceSaveMetadata } from '/@shared/entities/save'
import { resolveRuntimeVersion } from '/@shared/entities/version'
import { FileTypeHint } from '/@shared/services/ResourceService'

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
export const RESOURCE_PARSER_FORGE: ResourceParser<ForgeModCommonMetadata> = ({
  type: ResourceType.Forge,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta.logoFile) {
      return fs.readFile(meta.logoFile)
    }
    return undefined
  },
  parseMetadata: fs => readForgeMod(fs).then(normalizeForgeModMetadata),
  getSuggestedName: (meta) => {
    let name = `${meta.name || meta.modid}`
    if (meta.version) {
      name += `- ${meta.version}`
    }
    return name
  },
  getUri: meta => {
    const urls: string[] = []
    for (const m of meta.mcmodInfo) {
      urls.push(`forge:///${m.modid}/${m.version}`)
    }
    for (const m of meta.modsToml) {
      urls.push(`forge:///${m.modid}/${m.version}`)
    }
    for (const m of meta.modAnnotations) {
      if (m.modid && m.version) {
        const uri = `forge:///${m.modid}/${m.version}`
        if (urls.indexOf(uri) === -1) {
          urls.push(uri)
        }
      }
    }
    if (meta.manifestMetadata && meta.manifestMetadata.modid && meta.manifestMetadata.version) {
      const m = meta.manifestMetadata
      const uri = `forge:///${m.modid}/${m.version}`
      if (urls.indexOf(uri) === -1) {
        urls.push(uri)
      }
    }
    return urls
  },
})
export const RESOURCE_PARSER_LITELOADER: ResourceParser<LiteloaderModMetadata> = ({
  type: ResourceType.Liteloader,
  domain: ResourceDomain.Mods,
  ext: '.litemod',
  parseIcon: async () => undefined,
  parseMetadata: fs => readLiteloaderMod(fs),
  getSuggestedName: (meta) => {
    let name = ''
    if (typeof meta.name === 'string') {
      name += meta.name
    }
    if (typeof meta.mcversion === 'string') {
      name += `-${meta.mcversion}`
    }
    if (typeof meta.version === 'string') {
      name += `-${meta.version}`
    }
    if (typeof meta.revision === 'string' || typeof meta.revision === 'number') {
      name += `-${meta.revision}`
    }
    return name
  },
  getUri: meta => [`liteloader:///${meta.name}/${meta.version}`],
})
export const RESOURCE_PARSER_FABRIC: ResourceParser<FabricModMetadata> = ({
  type: ResourceType.Fabric,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta.icon) {
      return fs.readFile(meta.icon)
    }
    return Promise.resolve(undefined)
  },
  parseMetadata: async fs => readFabricMod(fs),
  getSuggestedName: (meta) => {
    let name = ''
    if (typeof meta.name === 'string') {
      name += meta.name
    } else if (typeof meta.id === 'string') {
      name += meta.id
    }
    if (typeof meta.version === 'string') {
      name += `-${meta.version}`
    } else {
      name += '-0.0.0'
    }
    return name
  },
  getUri: meta => [`fabric:///${meta.id}/${meta.version}`],
})
export const RESOURCE_PARSER_RESOURCE_PACK: ResourceParser<PackMeta.Pack> = ({
  type: ResourceType.ResourcePack,
  domain: ResourceDomain.ResourcePacks,
  ext: '.zip',
  parseIcon: async (meta, fs) => readIcon(fs),
  parseMetadata: fs => readPackMeta(fs),
  getSuggestedName: () => '',
  getUri: (_) => [],
})
export const RESOURCE_PARSER_SAVE: ResourceParser<ResourceSaveMetadata> = ({
  type: ResourceType.Save,
  domain: ResourceDomain.Saves,
  ext: '.zip',
  parseIcon: async (meta, fs) => fs.readFile('icon.png'),
  parseMetadata: async fs => {
    const root = await findLevelRootDirectory(fs, '')
    if (!root) throw new Error()
    return readResourceSaveMetadata(fs, root)
  },
  getSuggestedName: meta => meta.levelName,
  getUri: (_) => [],
})
export const RESOURCE_PARSER_MODPACK: ResourceParser<CurseforgeModpackManifest> = ({
  type: ResourceType.CurseforgeModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: fs => fs.readFile('manifest.json', 'utf-8').then(JSON.parse),
  getSuggestedName: () => '',
  getUri: (man) => [`curseforge://name/${man.name}/${man.version}`],
})
export const RESOURCE_PARSER_COMMON_MODPACK: ResourceParser<{ root: string; runtime: RuntimeVersions }> = ({
  type: ResourceType.Modpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: async (fs) => {
    const findRoot = async () => {
      if (await fs.isDirectory('./versions') &&
        await fs.isDirectory('./mods')) {
        return ''
      }
      if (await fs.isDirectory('.minecraft')) {
        return '.minecraft'
      }
      const files = await fs.listFiles('')
      for (const file of files) {
        if (await fs.isDirectory(file)) {
          if (await fs.isDirectory(fs.join(file, 'versions')) &&
            await fs.isDirectory(fs.join(file, 'mods'))) {
            return file
          }
          if (await fs.isDirectory(fs.join(file, '.minecraft'))) {
            return fs.join(file, '.minecraft')
          }
        }
      }
      throw new Error()
    }
    const root = await findRoot()
    const versions = await fs.listFiles(fs.join(root, 'versions'))
    const runtime: RuntimeVersions = {
      minecraft: '',
      fabricLoader: '',
      forge: '',
      liteloader: '',
      yarn: '',
    }
    for (const version of versions) {
      const json = await fs.readFile(fs.join(fs.join(root, 'versions', version, `${version}.json`)), 'utf-8')
      const partialVersion = Version.normalizeVersionJson(json, '')

      resolveRuntimeVersion(partialVersion, runtime)
    }

    return { root, runtime }
  },
  getSuggestedName: () => '',
  getUri: (_) => [],
})
export const RESOURCE_PARSERS = [
  RESOURCE_PARSER_COMMON_MODPACK,
  RESOURCE_PARSER_FORGE,
  RESOURCE_PARSER_FABRIC,
  RESOURCE_PARSER_LITELOADER,
  RESOURCE_PARSER_RESOURCE_PACK,
  RESOURCE_PARSER_SAVE,
  RESOURCE_PARSER_MODPACK,
]

// resource functions

/**
 * Create a resource builder from source.
 */
export function createPersistedResourceBuilder(source: SourceInformation = {}): PersistedResourceBuilder {
  return {
    name: '',
    location: '',
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
  const res = { ...builder }
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

export async function resolveResourceWithParser(path: string, fileType: FileType, sha1: string, stat: FileStat, parsers: ResourceParser<any>[]): Promise<[AnyResource, Uint8Array | undefined]> {
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
  const slice = sha1.slice(0, 6)
  const name = parser.getSuggestedName(metadata) || basename(path, ext)

  return [{
    path,
    location: join(parser.domain, `${name}.${slice}`),
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

  const chains: ResourceParser<any>[] = RESOURCE_PARSERS.filter(filterFunc)
  if (ext === '.zip') {
    chains.push(RESOURCE_PARSER_FORGE)
  }
  chains.push(UNKNOWN_ENTRY)
  return chains
}

export function resolveResource(path: string, fileType: FileType, sha1: string, stat: FileStat, typeHint?: FileTypeHint) {
  return resolveResourceWithParser(path, fileType, sha1, stat, getRecommendedResourceParsers(path, typeHint))
}

/**
 * Persist a resource to disk
 * @param resolved The resolved resource
 * @param respository The root of the persistence repo
 * @param source The source
 */
export async function persistResource(resolved: Resource, respository: string, source: SourceInformation, url: string[], icon: Uint8Array | undefined) {
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
  const slice = builder.hash.slice(0, 6)

  const location = join(builder.domain, `${name}.${slice}`)
  const filePath = join(respository, `${location}${builder.ext}`)
  const metadataPath = join(respository, `${location}.json`)
  const iconPath = join(respository, `${location}.png`)

  await ensureFile(filePath)
  await linkOrCopy(resolved.path, filePath)
  if (builder.icon) {
    await writeFile(iconPath, builder.icon)
  }

  const fileStatus = await stat(filePath)

  builder.location = location
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

  await unlink(filePath)
  await unlink(metadataPath)
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
