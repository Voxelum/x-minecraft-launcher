import { MinecraftFolder } from '@xmcl/core'
import { ResourceDomain } from '@xmcl/resource'
import {
  convertBlueprint,
  getBlockCount,
  getMaterialList,
  isAir,
  readBlueprint,
  ReplaceMode,
  replaceBlocks,
  writeBlueprint,
  BlueprintFormat,
} from '@xmcl/schematic'
import { FileSystem, openFileSystem } from '@xmcl/system'
import {
  BlueprintConvertOptions,
  BlueprintInfo,
  BlueprintReplaceOptions,
  InstanceBlueprintsService as IInstanceBlueprintsService,
  InstanceBlueprintsServiceKey,
} from '@xmcl/runtime-api'
import { pathExists, readdir, readFile, readJson, writeFile } from 'fs-extra'
import { isAbsolute, join } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, type PathResolver } from '~/app'
import { ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'

/**
 * Manage blueprint / schematic files of an instance, with conversion, smart
 * block replacement, material list and 3D preview support.
 */
@ExposeServiceKey(InstanceBlueprintsServiceKey)
export class InstanceBlueprintsService extends AbstractInstanceDomainService implements IInstanceBlueprintsService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app, ResourceDomain.Blueprints)
  }

  private resolveFile(instancePath: string, fileName: string) {
    if (isAbsolute(fileName)) return fileName
    return join(instancePath, this.domain, fileName)
  }

  async getBlueprintInfo(instancePath: string, fileName: string): Promise<BlueprintInfo> {
    const path = this.resolveFile(instancePath, fileName)
    const data = await readFile(path)
    const blueprint = await readBlueprint(data, path)
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
    return {
      format: blueprint.format,
      name: blueprint.name,
      author: blueprint.author,
      description: blueprint.description,
      dataVersion: blueprint.dataVersion,
      size: blueprint.size,
      blockCount: getBlockCount(blueprint),
      materials: getMaterialList(blueprint),
      palette: palette.map((s) => ({ name: s.name, properties: s.properties })),
      voxels,
    }
  }

  async getBlockTextures(instancePath: string, blocks: string[]): Promise<Record<string, string>> {
    // Collect texture sources: the vanilla version jar first (for `minecraft:`
    // assets and texture references), then the instance's mod jars (for modded
    // blocks such as `mcwroofs:deepslate_roof`). Mod jars are opened lazily and
    // we stop as soon as every requested block is resolved.
    const sources: FileSystem[] = []
    const result: Record<string, string> = {}
    const needed = new Set(blocks.filter((b) => b && b !== 'minecraft:air'))

    const readAsset = async (assetPath: string): Promise<Buffer | undefined> => {
      for (const fs of sources) {
        try {
          if (await fs.existsFile(assetPath)) {
            return Buffer.from(await fs.readFile(assetPath))
          }
        } catch {
          // ignore broken source
        }
      }
      return undefined
    }

    const resolveAll = async () => {
      await Promise.all([...needed].map(async (block) => {
        const texture = await this.resolveBlockTexture(readAsset, block).catch(() => undefined)
        if (texture) {
          result[block] = texture
          needed.delete(block)
        }
      }))
    }

    try {
      const minecraft = await this.resolveMinecraftVersion(instancePath)
      if (minecraft) {
        const jar = new MinecraftFolder(this.getPath()).getVersionJar(minecraft)
        if (await pathExists(jar)) {
          const fs = await openFileSystem(jar).catch(() => undefined)
          if (fs) sources.push(fs)
        }
      }

      await resolveAll()

      if (needed.size > 0) {
        const modsDir = join(instancePath, 'mods')
        const jars = (await readdir(modsDir).catch(() => [] as string[]))
          .filter((f) => f.endsWith('.jar'))
        for (const jarName of jars) {
          if (needed.size === 0) break
          const fs = await openFileSystem(join(modsDir, jarName)).catch(() => undefined)
          if (!fs) continue
          sources.push(fs)
          await resolveAll()
        }
      }
    } finally {
      for (const fs of sources) {
        try { fs.close() } catch { /* ignore */ }
      }
    }
    return result
  }

  private async resolveMinecraftVersion(instancePath: string): Promise<string | undefined> {
    try {
      const config = await readJson(join(instancePath, 'instance.json'))
      return config?.runtime?.minecraft
    } catch {
      return undefined
    }
  }

  private async resolveBlockTexture(
    readAsset: (assetPath: string) => Promise<Buffer | undefined>,
    block: string,
  ): Promise<string | undefined> {
    const [namespace, name] = splitNamespaced(block)

    // 1. Direct texture name match within the block's own namespace.
    const direct = await readAsset(`assets/${namespace}/textures/block/${name}.png`)
    if (direct) return direct.toString('base64')

    // 2. Resolve via the block model's `textures` map. References can point at a
    //    different namespace (e.g. a Macaw's Roofs model that uses
    //    `minecraft:block/deepslate`), so resolve the namespace per reference.
    const modelBytes = await readAsset(`assets/${namespace}/models/block/${name}.json`)
    if (modelBytes) {
      try {
        const model = JSON.parse(modelBytes.toString('utf-8'))
        const textures: Record<string, string> = model.textures ?? {}
        const ref = pickTextureRef(textures)
        if (ref) {
          const [texNs, texPath] = splitNamespaced(ref)
          const bytes = await readAsset(`assets/${texNs}/textures/${texPath}.png`)
          if (bytes) return bytes.toString('base64')
        }
      } catch {
        // ignore malformed model
      }
    }
    return undefined
  }

  async convertBlueprint(options: BlueprintConvertOptions): Promise<string> {
    const path = this.resolveFile(options.instancePath, options.fileName)
    const data = await readFile(path)
    const { data: out, extension } = await convertBlueprint(data, path, options.target as BlueprintFormat)
    const dir = join(options.instancePath, this.domain)
    const baseName = (options.output ?? stripExtension(basename(path))) + extension
    const dest = join(dir, baseName)
    await writeFile(dest, Buffer.from(out))
    return dest
  }

  async replaceBlueprintBlocks(options: BlueprintReplaceOptions): Promise<string> {
    const path = this.resolveFile(options.instancePath, options.fileName)
    const data = await readFile(path)
    const blueprint = await readBlueprint(data, path)
    replaceBlocks(
      blueprint,
      options.replacements,
      options.mode === 'precise' ? ReplaceMode.Precise : ReplaceMode.Simple,
    )
    const out = await writeBlueprint(blueprint, blueprint.format)
    const dest = options.output
      ? join(options.instancePath, this.domain, options.output)
      : path
    await writeFile(dest, Buffer.from(out))
    return dest
  }
}

function basename(p: string) {
  const norm = p.replace(/\\/g, '/')
  return norm.slice(norm.lastIndexOf('/') + 1)
}

function stripExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

/**
 * Split a namespaced id like `mcwroofs:deepslate_roof` or
 * `minecraft:block/deepslate` into `[namespace, path]`. Defaults the namespace
 * to `minecraft` when absent.
 */
function splitNamespaced(id: string): [string, string] {
  const colon = id.indexOf(':')
  if (colon === -1) return ['minecraft', id]
  return [id.slice(0, colon), id.slice(colon + 1)]
}

/**
 * Pick a representative texture reference from a model's `textures` map,
 * resolving `#variable` indirections. Returns a concrete reference (possibly
 * namespaced) or `undefined`.
 */
function pickTextureRef(textures: Record<string, string>): string | undefined {
  const order = ['all', 'top', 'side', 'end', 'front', 'texture', 'particle', 'cross', 'rail', 'wall', 'pane']
  const keys = [...order.filter((k) => k in textures), ...Object.keys(textures)]
  for (const key of keys) {
    let value = textures[key]
    let guard = 0
    while (typeof value === 'string' && value.startsWith('#') && guard++ < 8) {
      value = textures[value.slice(1)]
    }
    if (typeof value === 'string' && value && !value.startsWith('#')) {
      return value
    }
  }
  return undefined
}
