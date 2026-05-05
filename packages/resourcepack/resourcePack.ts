/**
 * The resource pack module to read Minecraft resource pack just like Minecraft in-game.
 *
 * You can open the ResourcePack by {@link ResourcePack.open} and get resource by {@link ResourcePack.get}.
 *
 * Or you can just load resource pack metadata by {@link readPackMetaAndIcon}.
 *
 * @packageDocumentation
 */

import { FileSystem, resolveFileSystem } from '@xmcl/system'
import { PackMeta } from './format'

/**
 * The Minecraft used object to map the game resource location.
 */
export class ResourceLocation {
  static deconstruct(path: string, appendPath = '') {
    const splitPath = path.split(':')

    const domain = splitPath.length > 1 && splitPath[0] ? splitPath[0] : 'minecraft'
    let resourcePath = splitPath.length > 1 ? splitPath[1] : splitPath[0]

    if (appendPath.length > 0) {
      if (appendPath.charAt(appendPath.length - 1) !== '/') {
        appendPath = appendPath + '/'
      }
      if (!resourcePath.startsWith(appendPath)) {
        resourcePath = appendPath + resourcePath
      }
    }

    return new ResourceLocation(domain, resourcePath)
  }

  /**
   * build from texture path
   */
  static ofTexturePath(location: string | ResourceLocation) {
    if (typeof location === 'string') {
      location = ResourceLocation.deconstruct(location)
    }
    return new ResourceLocation(location.domain, `textures/${location.path}.png`)
  }

  /**
   * build from model path
   */
  static ofBlockModelPath(location: string | ResourceLocation) {
    location = ResourceLocation.deconstruct(location.toString(), 'block/')
    return new ResourceLocation(location.domain, `models/${location.path}.json`)
  }

  static ofItemModelPath(location: string | ResourceLocation) {
    location = ResourceLocation.deconstruct(location.toString(), 'item/')
    return new ResourceLocation(location.domain, `models/${location.path}.json`)
  }

  static ofModelPath(location: string | ResourceLocation) {
    if (typeof location === 'string') {
      location = ResourceLocation.deconstruct(location)
    }
    return new ResourceLocation(location.domain, `models/${location.path}.json`)
  }

  /**
   * build from block state path
   */
  static ofBlockStatePath(location: string | ResourceLocation) {
    if (typeof location === 'string') {
      location = ResourceLocation.deconstruct(location)
    }
    return new ResourceLocation(location.domain, `blockstates/${location.path}.json`)
  }

  /**
   * from absoluted path
   */
  static fromPath(location: string | ResourceLocation) {
    return ResourceLocation.deconstruct(location.toString())
  }

  static getAssetsPath(location: string | ResourceLocation) {
    if (typeof location === 'string') {
      location = ResourceLocation.deconstruct(location)
    }
    return `assets/${location.domain}/${location.path}`
  }

  constructor(
    readonly domain: string,
    readonly path: string,
  ) {}

  toString() {
    return `${this.domain}:${this.path}`
  }
}

/**
 * The resource in the resource pack on a `ResourceLocation`
 * @see {@link ResourceLocation}
 */
export interface Resource {
  /**
   * The absolute location of the resource
   */
  readonly location: ResourceLocation
  /**
   * The real resource url which is used for reading the content of it.
   */
  readonly url: string
  /**
   * Read the resource content
   */
  read(): Promise<Uint8Array>
  read(encoding: undefined): Promise<Uint8Array>
  read(encoding: 'utf-8' | 'base64'): Promise<string>
  read(encoding?: 'utf-8' | 'base64'): Promise<Uint8Array | string>
  /**
   * Read the metadata of the resource
   */
  readMetadata(): Promise<PackMeta>
}

/**
 * The Minecraft resource pack. Providing the loading resource from `ResourceLocation` function.
 * It's a wrap of `FileSystem` which provides cross node/browser accssing.
 *
 * @see {@link ResourceLocation}
 * @see {@link FileSystem}
 */
export class ResourcePack {
  constructor(readonly fs: FileSystem) {}
  /**
   * Load the resource content
   * @param location The resource location
   * @param type The output type of the resource
   */
  async load(
    location: ResourceLocation,
    type?: 'utf-8' | 'base64',
  ): Promise<Uint8Array | string | undefined> {
    const p = this.getPath(location)
    if (await this.fs.existsFile(p)) {
      return this.fs.readFile(p, type)
    }
    return undefined
  }

  /**
   * Load the resource metadata which is localted at <resource-path>.mcmeta
   */
  async loadMetadata(location: ResourceLocation) {
    const p = this.getPath(location)
    const name = p.substring(0, p.lastIndexOf('.'))
    const metafileName = name + '.mcmeta'
    return (await this.fs.existsFile(metafileName))
      ? JSON.parse((await this.fs.readFile(metafileName, 'utf-8')).replace(/^\uFEFF/, ''))
      : {}
  }

  /**
   * Get the url of the resource location.
   * Please notice that this is depended on `FileSystem` implementation of the `getUrl`.
   *
   * @returns The absolute url like `file://` or `http://` depending on underlaying `FileSystem`.
   * @see {@link FileSystem}
   */
  getUrl(location: ResourceLocation) {
    const p = this.getPath(location)
    return this.fs.getUrl(p)
  }

  /**
   * Get the resource on the resource location.
   *
   * It can be undefined if there is no resource at that location.
   * @param location THe resource location
   */
  async get(location: ResourceLocation): Promise<Resource | undefined> {
    if (await this.has(location)) {
      return {
        location,
        url: this.getUrl(location),
        read: ((encoding: any) => this.load(location, encoding)) as any,
        readMetadata: () => this.loadMetadata(location),
      }
    }
  }

  /**
   * Does the resource pack has the resource
   */
  has(location: ResourceLocation): Promise<boolean> {
    return this.fs.existsFile(this.getPath(location))
  }

  /**
   * The owned domain. You can think about the modids.
   */
  async domains(): Promise<string[]> {
    const files = await this.fs.listFiles('assets')
    const result: string[] = []
    for (const f of files) {
      if (await this.fs.isDirectory('assets/' + f)) {
        result.push(f)
      }
    }
    return result
  }

  /**
   * The pack info, just like resource pack
   */
  async info(): Promise<PackMeta.Pack> {
    const { pack } = await this.fs.readFile('pack.mcmeta', 'utf-8').then(
      (s) => JSON.parse(s.replace(/^\uFEFF/, '')),
      () => {
        throw new Error('Illegal Resourcepack: Cannot find pack.mcmeta!')
      },
    )
    if (!pack) {
      throw new Error("Illegal Resourcepack: pack.mcmeta doesn't contain the pack metadata!")
    }
    return pack
  }

  /**
   * The icon of the resource pack
   */
  icon(): Promise<Uint8Array> {
    return this.fs.readFile('pack.png')
  }

  private getPath(location: ResourceLocation) {
    return `assets/${location.domain}/${location.path}`
  }

  static async open(resourcePack: string | Uint8Array | FileSystem): Promise<ResourcePack> {
    return new ResourcePack(await resolveFileSystem(resourcePack))
  }
}
