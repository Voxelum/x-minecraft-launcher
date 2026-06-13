import { InstanceFile, MMCComponentPatch, MMCModpackManifest, getInstanceConfigFromMmcModpack } from '@xmcl/instance'
import { readEntry } from '@xmcl/unzip'
import { Entry, ZipFile } from '@xmcl/yauzl'
import { LauncherApp } from '~/app'
import { ModpackHandler } from '../ModpackService'
import { parseCFG } from './cfg'
import { parseManifestJson } from './parseManifestJson'

export function createMmcHandler(app: LauncherApp): ModpackHandler<MMCModpackManifest> {
  return {
    async resolveModpackMarketMetadata(path, sha1) {
      return undefined
    },
    resolveUnpackPath: function (manifest, e) {
      const prefix = manifest.prefix ?? ''
      if (prefix && !e.fileName.startsWith(prefix)) return
      const rest = e.fileName.substring(prefix.length)
      // Prism Launcher exports use `minecraft/`; classic MultiMC uses `.minecraft/`.
      for (const overridePrefix of ['.minecraft/', 'minecraft/']) {
        if (rest.startsWith(overridePrefix)) {
          return rest.substring(overridePrefix.length)
        }
      }
    },
    readManifest: async (zipFile: ZipFile, entries: Entry[]): Promise<MMCModpackManifest | undefined> => {
      // Accept both `mmc-pack.json` at the zip root and a single nested root
      // folder (Prism Launcher's default export layout).
      let man = entries.find(e => e.fileName === 'mmc-pack.json')
      let prefix = ''
      if (!man) {
        const candidate = entries.find(e => /^[^/]+\/mmc-pack\.json$/.test(e.fileName))
        if (candidate) {
          man = candidate
          prefix = candidate.fileName.substring(0, candidate.fileName.length - 'mmc-pack.json'.length)
        }
      }
      if (!man) return

      const b = await readEntry(zipFile, man)
      const cfg = entries.find(e => e.fileName === `${prefix}instance.cfg`)
      let parsedCFG
      try {
        parsedCFG = cfg ? parseCFG((await readEntry(zipFile, cfg)).toString()) : {}
      } catch (e) {
        parsedCFG = {}
      }

      // Prism / MultiMC keep per-component patches under `patches/<uid>.json`.
      // Read them all so out-of-line `+jvmArgs` / `+tweakers` overrides can be
      // merged by `getInstanceConfigFromMmcModpack`.
      const patchPrefix = `${prefix}patches/`
      const patchEntries = entries.filter(e =>
        e.fileName.startsWith(patchPrefix) &&
        e.fileName.endsWith('.json') &&
        !e.fileName.endsWith('/'),
      )
      const patches: Record<string, MMCComponentPatch> = {}
      for (const pe of patchEntries) {
        try {
          const buf = await readEntry(zipFile, pe)
          const json = parseManifestJson<MMCComponentPatch>(buf)
          if (json && typeof json.uid === 'string') {
            patches[json.uid] = json
          }
        } catch {
          // Ignore individual unparsable patch files — the rest of the modpack
          // is still usable.
        }
      }

      return {
        json: parseManifestJson(b),
        cfg: parsedCFG,
        prefix: prefix || undefined,
        patches: Object.keys(patches).length ? patches : undefined,
      } as MMCModpackManifest
    },
    resolveInstanceOptions: getInstanceConfigFromMmcModpack,
    resolveInstanceFiles: async (): Promise<InstanceFile[]> => {
      return []
    },
  }
}