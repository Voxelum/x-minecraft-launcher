import { FileSystem, openFileSystem } from '@xmcl/system'
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
