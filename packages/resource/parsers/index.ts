import { FileSystem, openFileSystem } from '@xmcl/system'
import { getBlockCount, getMaterialList, getUsedBlocks, isAir, isBlueprintFile, readBlueprint } from '@xmcl/schematic'
import { readFile } from 'fs/promises'
import { basename, extname } from 'path'
import { fabricModParser } from './fabric_mod'
import { forgeModParser } from './forge_mod'
import { liteloaderModParser } from './liteloader_mod'
import { neoforgeModParser } from './neoforge_mod'
import { quiltModParser } from './quilt_mod'
import { resourcePackParser } from './resource_pack'
import { shaderPackParser } from './shader_pack'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import { ResourceMetadata } from '../ResourceMetadata'

export interface IResourceParser<T> {
  type: ResourceType
  domain: ResourceDomain
  ext: string
  parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>
  parseMetadata: (data: FileSystem, fileName: string, metadata: ResourceMetadata) => Promise<T>
  getSuggestedName: (metadata: T) => string
  /**
   * Get ideal uri for this resource
   */
  getUri: (metadata: T) => string[]
}

export type ParseResourceArgs = {
  path: string
  domain: ResourceDomain
  fileType: string
}

export type ParseResourceResult = {
  name: string
  metadata: ResourceMetadata
  uris: string[]
  icons: Uint8Array[]
}

export class ResourceParser {
  constructor(
    private parsers = [
      fabricModParser,
      quiltModParser,
      liteloaderModParser,
      forgeModParser,
      neoforgeModParser,
      shaderPackParser,
      resourcePackParser,
    ],
  ) {}

  async parse(args: ParseResourceArgs): Promise<ParseResourceResult> {
    const inspectExt = args.fileType === 'zip' ? '.zip' : undefined
    const ext = extname(args.path)

    // Blueprints (litematic / schem / structure nbt / building gadget) are
    // gzip-compressed NBT or JSON, not zip archives, so they cannot go through
    // `openFileSystem`. Parse them directly from the raw bytes.
    if ((args.domain === ResourceDomain.Blueprints || args.domain === ResourceDomain.Unclassified) && isBlueprintFile(args.path)) {
      try {
        const data = await readFile(args.path)
        const blueprint = await readBlueprint(data, args.path)
        const { size, palette, blocks } = blueprint
        const air = palette.map((s) => isAir(s))
        const voxels: number[] = []
        for (let y = 0; y < size.y; y++) {
          for (let z = 0; z < size.z; z++) {
            for (let x = 0; x < size.x; x++) {
              const idx = blocks[x + size.x * (z + size.z * y)]
              if (air[idx]) continue
              voxels.push(x, y, z, idx)
            }
          }
        }
        const metadata: ResourceMetadata = {
          [ResourceType.Blueprint]: {
            format: blueprint.format,
            size: blueprint.size,
            blockCount: getBlockCount(blueprint),
            blockTypeCount: getUsedBlocks(blueprint).length,
            dataVersion: blueprint.dataVersion,
            author: blueprint.author,
            materials: getMaterialList(blueprint),
            palette: palette.map((s) => ({ name: s.name, properties: s.properties })),
            voxels,
          },
        }
        return {
          name: blueprint.name || basename(args.path),
          metadata,
          uris: [],
          icons: [],
        }
      } catch (e) {
        if (args.domain === ResourceDomain.Blueprints) {
          return { name: basename(args.path), metadata: {}, uris: [], icons: [] }
        }
        // Unclassified: fall through to the regular pipeline.
      }
    }

    let parsers: IResourceParser<any>[]
    if (args.domain === ResourceDomain.Unclassified) {
      if (ext) {
        parsers = this.parsers.filter((r) => r.ext === ext)
        if (parsers.length === 0 && inspectExt) {
          parsers.push(...this.parsers.filter((r) => r.ext === inspectExt), forgeModParser)
        }
      } else {
        if (inspectExt) {
          parsers = this.parsers.filter((r) => r.ext === inspectExt).concat(forgeModParser)
        } else {
          parsers = [...this.parsers]
        }
      }
    } else {
      parsers = this.parsers.filter((r) => r.domain === args.domain)
    }

    const icons: Uint8Array[] = []
    const fs = await openFileSystem(args.path).catch((e) => {
      if (e.message === 'Invalid zip file') {
        Object.assign(e, { name: 'InvalidZipFileError' })
        throw e
      }
      if (e.message.startsWith('multi-disk zip files are not supported: found disk number')) {
        Object.assign(e, { name: 'MultiDiskZipFileError' })
        throw e
      }
      if (e.message.startsWith('invalid central directory file header signature')) {
        Object.assign(e, { name: 'InvalidCentralDirectoryFileHeaderError' })
      }
      if (e.message.startsWith('compressed/uncompressed size mismatch for stored file')) {
        Object.assign(e, { name: 'CompressedUncompressedSizeMismatchError' })
      }
      // Malformed EOCD record (truncated/corrupted zip — common for jars
      // downloaded with a broken transfer). yauzl throws a plain Error
      // without a discriminating name, so route by message and let the
      // upstream `handleParseError` map it to `parseResourceException`
      // (an `Exception`, which the telemetry sink skips). See #1431.
      if (e.message.startsWith('invalid comment length')) {
        Object.assign(e, { name: 'InvalidZipFileError' })
        throw e
      }
      if (e.message === 'end of central directory record signature not found') {
        Object.assign(e, { name: 'InvalidZipFileError' })
        throw e
      }
      if ('code' in e) {
        if (e.code === 'ENOENT') {
          Object.assign(e, { name: 'FileNotFoundError' })
        } else if (e.code === 'EPERM') {
          Object.assign(e, { name: 'PermissionError' })
        }
      }
      throw e
    })
    const container: ResourceMetadata = {}
    const fileName = basename(args.path)
    const uris = [] as string[]
    let name: string | undefined

    // if (args.domain === ResourceDomain.Unclassified) {
    //   const files = await fs.listFiles('')
    //   const isModpack = files.some(f => f.toLowerCase() === 'manifest.json' || f === 'mcbbs.packmeta' || f === 'modrinth.index.json')
    //   if (isModpack) {
    //     parsers = [
    //       modrinthModpackParser,
    //       mcbbsModpackParser,
    //       curseforgeModpackParser,
    //     ]
    //   }
    // }

    for (const parser of parsers) {
      if (args.domain !== ResourceDomain.Unclassified) {
        if (parser.domain !== args.domain) {
          continue
        }
      }
      try {
        const metadata = await parser.parseMetadata(fs, fileName, container)
        const icon = await parser.parseIcon(metadata, fs).catch(() => undefined)
        container[parser.type] = metadata
        uris.push(...parser.getUri(metadata))
        if (name) {
          name = parser.getSuggestedName(metadata)
        }
        if (icon) {
          icons.push(icon)
        }
      } catch (e) {
        // skip
      }
    }
    fs.close()

    return {
      name: name || fileName,
      metadata: container,
      uris,
      icons,
    }
  }
}
