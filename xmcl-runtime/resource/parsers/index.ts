import { ResourceDomain, ResourceMetadata, ResourceType } from '@xmcl/runtime-api'
import { FileSystem, openFileSystem } from '@xmcl/system'
import { basename, extname } from 'path'
import { curseforgeModpackParser } from './curseforgeModpack'
import { fabricModParser } from './fabricMod'
import { forgeModParser } from './forgeMod'
import { liteloaderModParser } from './liteloaderMod'
import { mcbbsModpackParser } from './mcbbsModpack'
import { modpackParser } from './modpack'
import { modrinthModpackParser } from './modrinthModpack'
import { quiltModParser } from './quiltMod'
import { resourcePackParser } from './resourcePack'
import { saveParser } from './save'
import { shaderPackParser } from './shaderPack'
import { mmcModpackParser } from './mmcModpack'

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
  constructor(private parsers = [
    modpackParser,
    fabricModParser,
    quiltModParser,
    liteloaderModParser,
    forgeModParser,
    shaderPackParser,
    modrinthModpackParser,
    resourcePackParser,
    saveParser,
    mcbbsModpackParser,
    curseforgeModpackParser,
    mmcModpackParser,
  ]) { }

  async parse(args: ParseResourceArgs): Promise<ParseResourceResult> {
    const inspectExt = args.fileType === 'zip' ? '.zip' : undefined
    const ext = extname(args.path)

    let parsers: IResourceParser<any>[]
    if (args.domain === ResourceDomain.Unclassified) {
      if (ext) {
        parsers = this.parsers.filter(r => r.ext === ext)
        if (parsers.length === 0 && inspectExt) {
          parsers.push(...this.parsers.filter(r => r.ext === inspectExt), forgeModParser)
        }
      } else {
        if (inspectExt) {
          parsers = this.parsers.filter(r => r.ext === inspectExt).concat(forgeModParser)
        } else {
          parsers = [...this.parsers]
        }
      }
    } else {
      parsers = this.parsers.filter(r => r.domain === args.domain)
    }

    const icons: Uint8Array[] = []
    const fs = await openFileSystem(args.path)
    const container: ResourceMetadata = {}
    const fileName = basename(args.path)
    const uris = [] as string[]
    let name: string | undefined

    if (args.domain === ResourceDomain.Unclassified) {
      const files = await fs.listFiles('')
      const isModpack = files.some(f => f.toLowerCase() === 'manifest.json' || f === 'mcbbs.packmeta' || f === 'modrinth.index.json')
      if (isModpack) {
        parsers = [
          modrinthModpackParser,
          mcbbsModpackParser,
          curseforgeModpackParser,
        ]
      }
    }

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
